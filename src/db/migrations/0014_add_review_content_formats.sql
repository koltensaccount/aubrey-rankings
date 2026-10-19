ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS content_format text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS draft_content_format text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_content_format_check') THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_content_format_check CHECK (content_format IN ('plain', 'markdown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_draft_content_format_check') THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_draft_content_format_check CHECK (draft_content_format IS NULL OR draft_content_format IN ('plain', 'markdown'));
  END IF;
END $$;
