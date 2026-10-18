-- Migration: Add notifications, notification preferences, and release tracking tables

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "recipient_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "actor_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "notification_type" text NOT NULL,
  "collection_id" text REFERENCES "collections"("id") ON DELETE CASCADE,
  "media_item_id" text REFERENCES "media_items"("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deduplication_key" text
);

CREATE INDEX IF NOT EXISTS "idx_notifications_recipient_created" ON "notifications" ("recipient_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_notifications_recipient_unread" ON "notifications" ("recipient_user_id", "read_at");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_notifications_dedup" ON "notifications" ("deduplication_key") WHERE "deduplication_key" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "notify_follows" boolean DEFAULT true NOT NULL,
  "notify_likes" boolean DEFAULT true NOT NULL,
  "notify_comments" boolean DEFAULT true NOT NULL,
  "notify_tv_releases" boolean DEFAULT true NOT NULL,
  "notify_movie_releases" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "release_tracking_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "tmdb_type" text NOT NULL,
  "tmdb_id" integer NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "baseline_date" text,
  "last_checked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_release_sub_user_col" ON "release_tracking_subscriptions" ("user_id", "collection_id");
CREATE INDEX IF NOT EXISTS "idx_release_sub_tmdb" ON "release_tracking_subscriptions" ("tmdb_type", "tmdb_id");

CREATE TABLE IF NOT EXISTS "processed_release_events" (
  "id" text PRIMARY KEY NOT NULL,
  "event_key" text NOT NULL,
  "tmdb_type" text NOT NULL,
  "tmdb_id" integer NOT NULL,
  "release_date" text,
  "metadata" jsonb,
  "processed_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_release_event_key" ON "processed_release_events" ("event_key");
