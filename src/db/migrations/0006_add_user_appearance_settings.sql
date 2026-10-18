-- Safe additive migration: Add preferred_theme and accent_color to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "preferred_theme" text DEFAULT 'dark';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accent_color" text DEFAULT '#89D5D5';
