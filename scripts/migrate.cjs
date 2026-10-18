// Packaged with the release: migrations and application always have the same revision.
const { Client } = require('pg');
const { readdirSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');

async function run({ connectionString = process.env.DATABASE_URL, directory = process.env.MIGRATIONS_DIR || (existsSync(join(__dirname, '../migrations')) ? join(__dirname, '../migrations') : join(__dirname, '../src/db/migrations')), baselineThrough } = {}) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const files = readdirSync(directory).filter(f => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  if (!files.length) throw new Error('Release has no SQL migrations');
  if (baselineThrough && !files.includes(baselineThrough)) throw new Error('Invalid baseline filename');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'; SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('aubrey-release-migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS public.aubrey_schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = new Map((await client.query('SELECT name, sha256 FROM public.aubrey_schema_migrations')).rows.map(r => [r.name, r.sha256]));
    for (const name of applied.keys()) if (!files.includes(name)) throw new Error(`Applied migration absent from release: ${name}`);
    const hasExistingSchema = (await client.query("SELECT to_regclass('public.user') IS NOT NULL AS present")).rows[0].present;
    if (!applied.size && hasExistingSchema && !baselineThrough) throw new Error('Existing database requires an explicitly verified one-time baseline before deployment');
    if (baselineThrough && applied.size) throw new Error('Baseline refused: migration history already exists');
    for (const name of files) {
      const sql = readFileSync(join(directory, name), 'utf8');
      const sha = createHash('sha256').update(sql).digest('hex');
      if (applied.has(name)) {
        if (applied.get(name) !== sha) throw new Error(`Migration checksum changed: ${name}`);
        continue;
      }
      if (baselineThrough && name <= baselineThrough) {
        // Adoption only: verify historical schema objects without replaying data backfills.
        for (const match of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? "(\w+)" \(([\s\S]*?)\n\);/g)) {
          const table = match[1];
          const columns = (await client.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1', [table])).rows;
          for (const col of match[2].matchAll(/^\s*"(\w+)" (text|integer|real|boolean|timestamp|jsonb)/gm)) {
            const expected = col[2] === 'timestamp' ? 'timestamp without time zone' : col[2];
            if (!columns.some(c => c.column_name === col[1] && c.data_type === expected)) throw new Error(`Baseline missing/mismatched column: ${table}.${col[1]}`);
          }
        }
        for (const match of sql.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN IF NOT EXISTS "(\w+)" (text|real)/g)) {
          const r = await client.query('SELECT 1 FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1 AND column_name=$2 AND data_type=$3', [match[1], match[2], match[3]]);
          if (!r.rowCount) throw new Error(`Baseline missing column: ${match[1]}.${match[2]}`);
        }
        for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX(?: IF NOT EXISTS)? "(\w+)"/g)) {
          const r = await client.query('SELECT to_regclass($1) AS name', [`public.${match[1]}`]);
          if (!r.rows[0].name) throw new Error(`Baseline missing index: ${match[1]}`);
        }
        console.log(`Verified baseline ${name}`);
      } else {
        await client.query(sql);
        console.log(`Applied ${name}`);
      }
      await client.query('INSERT INTO public.aubrey_schema_migrations(name, sha256) VALUES ($1,$2)', [name, sha]);
    }
    await client.query('COMMIT');
    console.log('Migration transaction committed');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
module.exports = { run };
if (require.main === module) {
  const baselineThrough = process.argv[2] === '--baseline-through' ? process.argv[3] : undefined;
  run({ baselineThrough }).catch(error => { console.error('Migration failed:', error.message); process.exitCode = 1; });
}
