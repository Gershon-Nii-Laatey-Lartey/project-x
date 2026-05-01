-- Migration: Telegram Connector System
-- Date: 2026-05-01 12:00:00
-- Description: Tables for Telegram User API integration (MTProto via GramJS)

-- ============================================================
-- 1. telegram_sessions — Stores the MTProto StringSession
-- ============================================================
CREATE TABLE IF NOT EXISTS public.telegram_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT,
    session_string TEXT,
    phone_code_hash TEXT,
    is_authenticated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view telegram sessions status"
    ON public.telegram_sessions FOR SELECT USING (true);

CREATE POLICY "Public can manage telegram sessions"
    ON public.telegram_sessions FOR ALL USING (true);

-- ============================================================
-- 2. telegram_channels — Tracks which channels to monitor
-- ============================================================
CREATE TABLE IF NOT EXISTS public.telegram_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id TEXT NOT NULL UNIQUE,
    channel_name TEXT NOT NULL,
    channel_username TEXT,
    channel_photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_message_id BIGINT DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telegram_channels_active ON public.telegram_channels (is_active);

ALTER TABLE public.telegram_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view telegram channels"
    ON public.telegram_channels FOR SELECT USING (true);

CREATE POLICY "Public can manage telegram channels"
    ON public.telegram_channels FOR ALL USING (true);

-- ============================================================
-- 3. telegram_messages — Stores fetched messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.telegram_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id TEXT NOT NULL,
    telegram_message_id BIGINT NOT NULL,
    message_text TEXT,
    media_type TEXT,
    media_url TEXT,
    media_file_id TEXT,
    thumbnail_url TEXT,
    raw_data JSONB,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    saved_to_subject TEXT,
    UNIQUE(channel_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_channel ON public.telegram_messages (channel_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_sent ON public.telegram_messages (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_media ON public.telegram_messages (media_type) WHERE media_type IS NOT NULL;

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view telegram messages"
    ON public.telegram_messages FOR SELECT USING (true);

CREATE POLICY "Public can manage telegram messages"
    ON public.telegram_messages FOR ALL USING (true);

-- ============================================================
-- 4. Storage: ensure papers bucket exists (idempotent)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', true)
ON CONFLICT (id) DO NOTHING;
