-- Additive migration: Add visibility to collections ('private' | 'unlisted' | 'public')
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'private';
--> statement-breakpoint
UPDATE "collections" SET "visibility" = CASE WHEN "is_public" = true THEN 'public' ELSE 'private' END WHERE "visibility" = 'private';
