-- Additive migration: Letterboxd source rating and service attribution columns
ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "source_rating" real;
--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "source_scale" real;
--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "source_service" text;
--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "letterboxd_uri" text;
