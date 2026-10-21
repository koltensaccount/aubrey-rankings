-- Phase 14A: Personal Library Foundation & Complete Letterboxd Import

-- 1. Watchlist items table
CREATE TABLE IF NOT EXISTS "watchlist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"media_item_id" text NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_watchlist_media" ON "watchlist_items" ("user_id", "media_item_id");
CREATE INDEX IF NOT EXISTS "idx_watchlist_user_created" ON "watchlist_items" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_watchlist_media" ON "watchlist_items" ("media_item_id");

-- 2. Diary entries table
CREATE TABLE IF NOT EXISTS "diary_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"media_item_id" text NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
	"rating_id" text REFERENCES "ratings"("id") ON DELETE SET NULL,
	"review_id" text REFERENCES "reviews"("id") ON DELETE SET NULL,
	"watched_date" text,
	"logged_date" timestamp,
	"is_rewatch" boolean DEFAULT false NOT NULL,
	"rating_value" real,
	"tags" jsonb,
	"notes" text,
	"source_service" text,
	"source_uri" text,
	"source_event_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_diary_user_watched" ON "diary_entries" ("user_id", "watched_date");
CREATE INDEX IF NOT EXISTS "idx_diary_user_media" ON "diary_entries" ("user_id", "media_item_id");
CREATE INDEX IF NOT EXISTS "idx_diary_review" ON "diary_entries" ("review_id");
CREATE INDEX IF NOT EXISTS "idx_diary_rating" ON "diary_entries" ("rating_id");
CREATE INDEX IF NOT EXISTS "idx_diary_source_uri" ON "diary_entries" ("user_id", "source_uri");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_diary_source_event" ON "diary_entries" ("user_id", "source_event_key") WHERE "source_event_key" IS NOT NULL;

-- 3. Unresolved import items table (for audit, transparency, and preserving ambiguous items)
CREATE TABLE IF NOT EXISTS "unresolved_import_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"source_service" text NOT NULL,
	"source_type" text NOT NULL,
	"source_data" jsonb NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_unresolved_user" ON "unresolved_import_items" ("user_id", "created_at");

-- 4. Review additions for source provenance and diary link
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "source_service" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "source_uri" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "watched_date" text;
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_reviews_source_uri" ON "reviews" ("user_id", "source_service", "source_uri") WHERE "source_uri" IS NOT NULL;

-- 5. Collections additions for imported custom lists
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "source_service" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "source_uri" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "is_ranked" boolean DEFAULT true NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_collections_source_uri" ON "collections" ("user_id", "source_service", "source_uri") WHERE "source_uri" IS NOT NULL;
