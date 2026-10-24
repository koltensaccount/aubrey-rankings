-- Retain every review and its provenance; a film URI is not a review identity.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source_event_key text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source_review_date text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source_snapshot jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_source_event ON reviews(user_id, source_service, source_event_key) WHERE source_event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_source_uri ON reviews(user_id, source_service, source_uri);
DROP INDEX IF EXISTS uniq_reviews_source_uri;
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS source_service text;
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS source_added_date text;
CREATE INDEX IF NOT EXISTS idx_activity_user_date_id ON activity_events(user_id, event_date DESC, created_at DESC, id DESC);
-- Old watchlist rows have no verified per-item provenance. An imported rating
-- for the same user/title does not prove the watchlist entry was imported.
-- Preserve existing timestamps and any explicit source metadata. Leave unproven
-- provenance unset; recovering historical import dates requires authentic source
-- information, never inference from another activity.
