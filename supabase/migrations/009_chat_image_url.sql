-- Add image_url column to chat_messages for photo-based food logging
alter table chat_messages add column image_url text;
