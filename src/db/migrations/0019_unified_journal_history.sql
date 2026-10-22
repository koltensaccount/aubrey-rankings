-- Phase 15B: Unified Notes, Reviews, Ratings & Activity Timeline

-- 1. Universal Media Notes (One private notes document per user/media)
CREATE TABLE IF NOT EXISTS "media_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"media_item_id" text NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_media_notes" ON "media_notes" ("user_id", "media_item_id");
CREATE INDEX IF NOT EXISTS "idx_media_notes_user" ON "media_notes" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_media_notes_media" ON "media_notes" ("media_item_id");

-- 2. Add share_notes to collection_entries for explicit ranking commentary sharing
ALTER TABLE "collection_entries" ADD COLUMN IF NOT EXISTS "share_notes" boolean DEFAULT false NOT NULL;

-- 3. Enhance reviews with direct score provenance and optional viewing link
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "rating_value" real;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "source_rating" real;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "source_scale" real;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "viewing_id" text REFERENCES "diary_entries"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_reviews_viewing" ON "reviews" ("viewing_id");

-- 4. Unified Chronological Activity Events table
CREATE TABLE IF NOT EXISTS "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"media_item_id" text NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
	"event_type" text NOT NULL,
	"event_date" text,
	"logged_date" timestamp,
	"diary_entry_id" text REFERENCES "diary_entries"("id") ON DELETE CASCADE,
	"review_id" text REFERENCES "reviews"("id") ON DELETE CASCADE,
	"rating_id" text REFERENCES "ratings"("id") ON DELETE CASCADE,
	"watchlist_item_id" text REFERENCES "watchlist_items"("id") ON DELETE CASCADE,
	"rating_value" real,
	"source_rating" real,
	"source_scale" real,
	"is_rewatch" boolean DEFAULT false NOT NULL,
	"notes" text,
	"source_service" text,
	"source_uri" text,
	"source_event_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_activity_source_event" ON "activity_events" ("user_id", "source_event_key") WHERE "source_event_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_activity_user_date" ON "activity_events" ("user_id", "event_date");
CREATE INDEX IF NOT EXISTS "idx_activity_user_type" ON "activity_events" ("user_id", "event_type");
CREATE INDEX IF NOT EXISTS "idx_activity_user_media" ON "activity_events" ("user_id", "media_item_id");
CREATE INDEX IF NOT EXISTS "idx_activity_diary" ON "activity_events" ("diary_entry_id");
CREATE INDEX IF NOT EXISTS "idx_activity_review" ON "activity_events" ("review_id");
CREATE INDEX IF NOT EXISTS "idx_activity_rating" ON "activity_events" ("rating_id");
CREATE INDEX IF NOT EXISTS "idx_activity_watchlist" ON "activity_events" ("watchlist_item_id");
