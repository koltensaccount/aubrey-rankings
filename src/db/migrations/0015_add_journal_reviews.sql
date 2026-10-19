ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_journal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reviews_journal_owner_media
  ON reviews (user_id, media_item_id, updated_at DESC)
  WHERE is_journal = true;
