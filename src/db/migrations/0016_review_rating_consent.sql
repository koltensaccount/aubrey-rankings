ALTER TABLE reviews ADD COLUMN IF NOT EXISTS share_rating boolean NOT NULL DEFAULT false;
