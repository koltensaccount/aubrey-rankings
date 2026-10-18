-- Migration: Add parent_id, is_spoiler, and is_edited to comments for replies and spoiler warnings

ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_id" text REFERENCES "comments"("id") ON DELETE CASCADE;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "is_spoiler" boolean NOT NULL DEFAULT false;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "is_edited" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_comments_parent" ON "comments" ("parent_id");
