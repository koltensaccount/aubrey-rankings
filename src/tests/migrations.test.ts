import { it } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { createRequire } from 'node:module';
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { run } = createRequire(import.meta.url)('../../scripts/migrate.cjs');
it('release migrations are atomic, repeatable, checksum protected and adopt legacy schemas without replay', async () => {
  const base = process.env.DATABASE_URL || 'postgresql://koltenbendickson@localhost:5432/aubrey_rankings';
  const name = `aubrey_migration_test_${process.pid}_${Date.now()}`;
  const admin = new Client({connectionString:base});
  await admin.connect();
  const directory = mkdtempSync(join(tmpdir(), 'aubrey-migrations-'));
  let db: Client | undefined;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(base); url.pathname = `/${name}`;
    const connectionString = url.toString();
    cpSync(resolve('src/db/migrations'), directory, {recursive:true});
    const options = {connectionString,directory};
    await run(options);
    await run(options);
    db = new Client({connectionString}); await db.connect();
    assert.equal((await db.query('SELECT count(*) FROM aubrey_schema_migrations')).rows[0].count, '7');
    writeFileSync(join(directory,'0007_test_failure.sql'), 'CREATE TABLE must_rollback(id integer); SELECT * FROM missing_relation;');
    await assert.rejects(run(options));
    assert.equal((await db.query("SELECT to_regclass('public.must_rollback') AS name")).rows[0].name, null);
    rmSync(join(directory,'0007_test_failure.sql'));
    writeFileSync(join(directory,'0005_add_bug_reports.sql'), '-- tampered');
    await assert.rejects(run(options), /checksum changed/);
    cpSync(resolve('src/db/migrations/0005_add_bug_reports.sql'), join(directory,'0005_add_bug_reports.sql'));
    await db.query('DROP TABLE aubrey_schema_migrations');
    await assert.rejects(run(options), /explicitly verified/);
    await run({...options,baselineThrough:'0004_add_social_features.sql'});
    await assert.rejects(run({...options,baselineThrough:'0004_add_social_features.sql'}), /history already exists/);
    assert.equal((await db.query('SELECT count(*) FROM aubrey_schema_migrations')).rows[0].count, '7');
  } finally {
    await db?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
    rmSync(directory,{recursive:true,force:true});
  }
});
