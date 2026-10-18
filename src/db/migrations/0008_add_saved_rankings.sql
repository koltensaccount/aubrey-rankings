-- Migration: Add saved_rankings table for bookmarking public and shared collections

CREATE TABLE IF NOT EXISTS "saved_rankings" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_collection_saved" ON "saved_rankings" ("user_id", "collection_id");
CREATE INDEX IF NOT EXISTS "idx_saved_rankings_user" ON "saved_rankings" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_saved_rankings_collection" ON "saved_rankings" ("collection_id");
