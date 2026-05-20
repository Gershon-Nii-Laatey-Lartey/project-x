-- Migration: Telegram Poll Cron Job
-- Date: 2026-05-01 18:00:00
-- Description: Schedule the edge function to scrape Telegram channels every 60 seconds.

-- 1. Enable the pg_net extension (required to make HTTP requests from the database)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule the cron job to run every minute (* * * * *)
SELECT cron.schedule(
  'invoke-telegram-poll',
  '* * * * *',
  $$
    SELECT net.http_post(
        url := 'https://fgxawdstesyqqqobycic.supabase.co/functions/v1/telegram-poll',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_soYcKmwjUUht7mIaZWZyAQ_s1MleJOC"}'::jsonb,
        body := '{}'::jsonb
    ) AS request_id;
  $$
);
