-- Migration 0012: Add first-class reviews table and link comments, likes, and notifications
-- Strictly additive and non-destructive: existing ratings, reviewText, and notes are preserved untouched.

-- 1. Create reviews table
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "media_item_id" text NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "rating_id" text REFERENCES "ratings"("id") ON DELETE SET NULL,
  "title" text,
  "content" text NOT NULL,
  "draft_content" text,
  "status" text NOT NULL DEFAULT 'draft',
  "visibility" text NOT NULL DEFAULT 'public',
  "is_spoiler" boolean NOT NULL DEFAULT false,
  "published_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_reviews_user" ON "reviews" ("user_id", "status", "visibility");
CREATE INDEX IF NOT EXISTS "idx_reviews_media" ON "reviews" ("media_item_id", "status", "visibility");
CREATE INDEX IF NOT EXISTS "idx_reviews_published" ON "reviews" ("status", "visibility", "published_at");
CREATE INDEX IF NOT EXISTS "idx_reviews_user_media" ON "reviews" ("user_id", "media_item_id");
CREATE INDEX IF NOT EXISTS "idx_reviews_rating" ON "reviews" ("rating_id");

-- 2. Extend comments table to optionally target reviews
ALTER TABLE "comments" ALTER COLUMN "collection_id" DROP NOT NULL;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "review_id" text REFERENCES "reviews"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_comments_review" ON "comments" ("review_id", "created_at");

-- 3. Extend likes table to optionally target reviews
ALTER TABLE "likes" ALTER COLUMN "collection_id" DROP NOT NULL;
ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "review_id" text REFERENCES "reviews"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_likes_review" ON "likes" ("review_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_review_like" ON "likes" ("user_id", "review_id") WHERE "review_id" IS NOT NULL;

-- 4. Extend notifications table to optionally reference reviews
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "review_id" text REFERENCES "reviews"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_notifications_review" ON "notifications" ("review_id");
