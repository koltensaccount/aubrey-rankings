-- Phase 14D: Import Lab, Persisted Mappings, and Rating Scale Semantics

-- 1. Import source mappings table (persisted confirmed mappings between Letterboxd and Aubrey media)
CREATE TABLE IF NOT EXISTS "import_source_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"source_service" text NOT NULL,
	"source_uri" text,
	"source_title" text NOT NULL,
	"source_year" integer,
	"source_media_type" text DEFAULT 'movie' NOT NULL,
	"media_item_id" text NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
	"confidence" text DEFAULT 'tmdb_verified' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_import_mapping_uri" ON "import_source_mappings" ("source_service", "source_uri") WHERE "source_uri" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_import_mapping_title_year" ON "import_source_mappings" ("source_service", "source_title", "source_year");
CREATE INDEX IF NOT EXISTS "idx_import_mapping_media" ON "import_source_mappings" ("media_item_id");

-- 2. Add source rating and scale to diary entries for authentic rating provenance
ALTER TABLE "diary_entries" ADD COLUMN IF NOT EXISTS "source_rating" real;
ALTER TABLE "diary_entries" ADD COLUMN IF NOT EXISTS "source_scale" real;

-- 3. Add test workspace flag to users table for strong isolation
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_test_workspace" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_user_test_workspace" ON "user" ("is_test_workspace") WHERE "is_test_workspace" = true;
