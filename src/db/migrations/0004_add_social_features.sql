-- Aubrey Rankings Stage 5: Social Features (Follows, Likes, Comments, Feed Activities)

CREATE TABLE IF NOT EXISTS "follows" (
  "id" text PRIMARY KEY NOT NULL,
  "follower_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "following_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_follower_following" ON "follows" ("follower_id", "following_id");
CREATE INDEX IF NOT EXISTS "idx_follows_follower" ON "follows" ("follower_id");
CREATE INDEX IF NOT EXISTS "idx_follows_following" ON "follows" ("following_id");

CREATE TABLE IF NOT EXISTS "likes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_collection_like" ON "likes" ("user_id", "collection_id");
CREATE INDEX IF NOT EXISTS "idx_likes_collection" ON "likes" ("collection_id");
CREATE INDEX IF NOT EXISTS "idx_likes_user" ON "likes" ("user_id");

CREATE TABLE IF NOT EXISTS "comments" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_comments_collection" ON "comments" ("collection_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_comments_user" ON "comments" ("user_id");

CREATE TABLE IF NOT EXISTS "feed_activities" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "activity_type" text NOT NULL,
  "collection_id" text REFERENCES "collections"("id") ON DELETE CASCADE,
  "metadata" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_feed_activities_user_created" ON "feed_activities" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_feed_activities_collection" ON "feed_activities" ("collection_id");
