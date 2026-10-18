---
name: safe-database-migration
description: Procedures for authoring, applying, and testing forward-compatible PostgreSQL migrations with checksum protection.
---

# Safe Database Migration Skill

Use this skill whenever altering tables, columns, constraints, or indexes in the database.

## 1. Golden Rules of Database Migrations

1. **Additive Only**: Never drop existing columns or rewrite existing data without explicit backward-compatibility support. Existing ratings, imports, and user accounts must remain intact.
2. **Never Edit Past Migrations**: Existing migration files (`0000_...sql` through `0010_...sql`) are protected by SHA-256 checksums in the `aubrey_schema_migrations` table. Altering an existing migration file will fail future deployments.
3. **Always Run in a Transaction**: Ensure SQL commands can be rolled back cleanly if a statement fails.
4. **Safe Defaults**: If adding a `NOT NULL` column, always provide a default value (e.g. `DEFAULT 'everyone'`, `DEFAULT false`).

## 2. Step-by-Step Procedure

### Step 1: Create the New Migration File
Find the next available migration number:
```bash
ls src/db/migrations/
```
Create `src/db/migrations/0011_<descriptive_name>.sql`.

Example SQL:
```sql
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "new_setting" text NOT NULL DEFAULT 'standard';
CREATE INDEX IF NOT EXISTS "idx_user_new_setting" ON "user" ("new_setting");
```

### Step 2: Update Drizzle Schema
Open `src/db/schema.ts` and add the matching column or table definition:
```ts
export const user = pgTable("user", {
  // ...
  newSetting: text("new_setting").notNull().default("standard"),
});
```

### Step 3: Apply the Migration Locally
```bash
node --env-file=.env.local scripts/migrate.cjs
```

### Step 4: Update Migration Verification Test
Open `src/tests/migrations.test.ts` and update the expected migration count assertion:
```ts
assert.equal((await db.query('SELECT count(*) FROM aubrey_schema_migrations')).rows[0].count, '<new_count>');
```

### Step 5: Verify Rollback Isolation
Run the migration test suite to ensure atomicity and rollback safety:
```bash
node --test src/tests/migrations.test.ts
```
