-- Add image_urls array column to chat_messages so a single message can carry multiple photos.
-- The legacy image_url column is preserved for backwards compatibility (read fallback).
alter table chat_messages add column if not exists image_urls text[];
