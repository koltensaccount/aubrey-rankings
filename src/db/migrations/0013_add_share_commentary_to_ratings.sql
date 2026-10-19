-- Migration 0013: Add share_commentary to ratings table for explicit commentary sharing consent
-- Strictly additive and non-destructive: defaults to false to preserve privacy of existing notes.

ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "share_commentary" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "idx_ratings_share_commentary" ON "ratings" ("share_commentary");
