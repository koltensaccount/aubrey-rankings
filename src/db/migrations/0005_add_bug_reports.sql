-- Aubrey Rankings: Bug Reporting System

CREATE TABLE IF NOT EXISTS "bug_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "description" text NOT NULL,
  "page_url" text NOT NULL,
  "user_agent" text,
  "screenshot_url" text,
  "status" text DEFAULT 'open' NOT NULL,
  "admin_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_bug_reports_status" ON "bug_reports" ("status");
CREATE INDEX IF NOT EXISTS "idx_bug_reports_created_at" ON "bug_reports" ("created_at");
