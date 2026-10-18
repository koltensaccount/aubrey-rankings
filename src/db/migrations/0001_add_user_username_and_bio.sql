-- Safe additive migration: Add username and bio to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bio" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_username_lower" ON "user" (LOWER("username"));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_unique" ON "user" ("username");
