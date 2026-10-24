import { it } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { createRequire } from 'node:module';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { run } = createRequire(import.meta.url)('../../scripts/migrate.cjs');
it('release migrations are atomic, repeatable, checksum protected and adopt legacy schemas without replay', async () => {
  const base = process.env.DATABASE_URL || 'postgresql://koltenbendickson@localhost:5432/aubrey_rankings';
  const name = `aubrey_migration_test_${process.pid}_${Date.now()}`;
  const admin = new Client({connectionString:base});
  await admin.connect();
  const directory = mkdtempSync(join(tmpdir(), 'aubrey-migrations-'));
  const expectedCount = readdirSync(resolve('src/db/migrations')).filter(f => f.endsWith('.sql')).length.toString();
  let db: Client | undefined;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(base); url.pathname = `/${name}`;
    const connectionString = url.toString();
    cpSync(resolve('src/db/migrations'), directory, {recursive:true});
    const options = {connectionString,directory};
    // Seed a real pre-0020 combination: native watchlist + imported rating.
    const correctiveMigration = '0020_postmerge_source_identity.sql';
    rmSync(join(directory, correctiveMigration));
    await run(options);
    db = new Client({connectionString}); await db.connect();
    await db.query(`INSERT INTO "user" (id, name, email) VALUES ('native-watchlist-owner', 'Native owner', 'native-watchlist@test.local')`);
    await db.query(`INSERT INTO media_items (id, title, media_type) VALUES ('native-watchlist-film', 'Native watchlist film', 'movie')`);
    await db.query(`INSERT INTO ratings (id, user_id, media_item_id, source_service, source_rating, source_scale) VALUES ('imported-rating', 'native-watchlist-owner', 'native-watchlist-film', 'letterboxd', 4, 5)`);
    await db.query(`INSERT INTO watchlist_items (id, user_id, media_item_id, created_at, updated_at) VALUES ('native-watchlist', 'native-watchlist-owner', 'native-watchlist-film', '2021-06-15 18:30:00', '2021-06-15 18:30:00')`);
    cpSync(resolve('src/db/migrations', correctiveMigration), join(directory, correctiveMigration));
    await run(options);
    await run(options);
    const nativeWatchlist = (await db.query(`SELECT source_service, source_added_date, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated FROM watchlist_items WHERE id = 'native-watchlist'`)).rows[0];
    assert.deepEqual(nativeWatchlist, { source_service: null, source_added_date: null, created: '2021-06-15 18:30:00', updated: '2021-06-15 18:30:00' });
    // Verified provenance, when present, must survive a direct safe rerun too.
    await db.query(`UPDATE watchlist_items SET source_service = 'letterboxd', source_added_date = '2020-04-03' WHERE id = 'native-watchlist'`);
    await db.query(readFileSync(join(directory, correctiveMigration), 'utf8'));
    assert.equal((await db.query(`SELECT source_added_date FROM watchlist_items WHERE id = 'native-watchlist'`)).rows[0].source_added_date, '2020-04-03');
    assert.equal((await db.query('SELECT count(*) FROM aubrey_schema_migrations')).rows[0].count, expectedCount);
    writeFileSync(join(directory,'0013_test_failure.sql'), 'CREATE TABLE must_rollback(id integer); SELECT * FROM missing_relation;');
    await assert.rejects(run(options));
    assert.equal((await db.query("SELECT to_regclass('public.must_rollback') AS name")).rows[0].name, null);
    rmSync(join(directory,'0013_test_failure.sql'));
    writeFileSync(join(directory, correctiveMigration), '-- tampered corrective migration');
    await assert.rejects(run(options), /checksum changed/);
    cpSync(resolve('src/db/migrations', correctiveMigration), join(directory, correctiveMigration));
    writeFileSync(join(directory,'0005_add_bug_reports.sql'), '-- tampered');
    await assert.rejects(run(options), /checksum changed/);
    cpSync(resolve('src/db/migrations/0005_add_bug_reports.sql'), join(directory,'0005_add_bug_reports.sql'));
    await db.query('DROP TABLE aubrey_schema_migrations');
    await assert.rejects(run(options), /explicitly verified/);
    await run({...options,baselineThrough:'0004_add_social_features.sql'});
    await assert.rejects(run({...options,baselineThrough:'0004_add_social_features.sql'}), /history already exists/);
    assert.equal((await db.query('SELECT count(*) FROM aubrey_schema_migrations')).rows[0].count, expectedCount);
  } finally {
    await db?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
    rmSync(directory,{recursive:true,force:true});
  }
});
