-- Migration: Add user_blocks, content_reports, comment_permission, and review privacy defaults

CREATE TABLE IF NOT EXISTS "user_blocks" (
  "id" text PRIMARY KEY NOT NULL,
  "blocker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "blocked_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_blocks_pair" ON "user_blocks" ("blocker_id", "blocked_id");
CREATE INDEX IF NOT EXISTS "idx_user_blocks_blocker" ON "user_blocks" ("blocker_id");
CREATE INDEX IF NOT EXISTS "idx_user_blocks_blocked" ON "user_blocks" ("blocked_id");

CREATE TABLE IF NOT EXISTS "content_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "reporter_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "reason" text NOT NULL,
  "details" text,
  "status" text DEFAULT 'open' NOT NULL,
  "admin_notes" text,
  "resolved_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_content_reports_open" ON "content_reports" ("reporter_id", "target_type", "target_id") WHERE "status" = 'open';
CREATE INDEX IF NOT EXISTS "idx_content_reports_target" ON "content_reports" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "idx_content_reports_status" ON "content_reports" ("status");
CREATE INDEX IF NOT EXISTS "idx_content_reports_reporter" ON "content_reports" ("reporter_id");

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "comment_permission" text NOT NULL DEFAULT 'everyone';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "default_review_visibility" text NOT NULL DEFAULT 'private';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "default_review_spoiler" boolean NOT NULL DEFAULT false;

ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "allow_comments" boolean NOT NULL DEFAULT true;

ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "notify_replies" boolean NOT NULL DEFAULT true;
