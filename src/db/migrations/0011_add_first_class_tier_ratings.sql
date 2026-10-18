-- Migration: Add first-class tier rating systems, rating_tiers table, and ON DELETE RESTRICT assignment protection

-- 1. Rating systems: add type and allow nullable user_id for built-in system templates
ALTER TABLE "rating_systems" ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'numerical';
ALTER TABLE "rating_systems" ALTER COLUMN "user_id" DROP NOT NULL;

-- 2. Drop and recreate default index to ignore NULL user_id
DROP INDEX IF EXISTS "uniq_user_default_rating_system";
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_default_rating_system" ON "rating_systems" ("user_id") WHERE ("user_id" IS NOT NULL AND "is_default" = true);

-- 3. Create rating_tiers table
CREATE TABLE IF NOT EXISTS "rating_tiers" (
  "id" text PRIMARY KEY NOT NULL,
  "rating_system_id" text NOT NULL REFERENCES "rating_systems"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "color" text NOT NULL DEFAULT '#FF4757',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tiers_system" ON "rating_tiers" ("rating_system_id", "sort_order");

-- 4. Add tier_id to ratings with ON DELETE RESTRICT
ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "tier_id" text REFERENCES "rating_tiers"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "idx_ratings_tier" ON "ratings" ("tier_id");

-- 5. Seed persisted built-in tier system template
INSERT INTO "rating_systems" ("id", "user_id", "name", "description", "scale", "is_default", "is_system_template", "type")
VALUES ('rs_template_standard_tiers', NULL, 'Standard Tier List', 'Classic S, A, B, C, D tier evaluation rubric', 10, false, true, 'tier')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "rating_tiers" ("id", "rating_system_id", "name", "description", "color", "sort_order")
VALUES 
  ('tier_std_s', 'rs_template_standard_tiers', 'S', 'Masterpiece / Elite', '#FF4757', 1),
  ('tier_std_a', 'rs_template_standard_tiers', 'A', 'Great / Highly Recommended', '#FFA502', 2),
  ('tier_std_b', 'rs_template_standard_tiers', 'B', 'Good / Solid', '#2ED573', 3),
  ('tier_std_c', 'rs_template_standard_tiers', 'C', 'Average / Mixed', '#1E90FF', 4),
  ('tier_std_d', 'rs_template_standard_tiers', 'D', 'Subpar / Disappointing', '#747D8C', 5)
ON CONFLICT ("id") DO NOTHING;
