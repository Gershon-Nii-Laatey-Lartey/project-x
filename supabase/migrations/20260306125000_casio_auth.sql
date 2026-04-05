-- Add simple auth for Casio AI
CREATE TABLE IF NOT EXISTS casio_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL, -- 4 digit pin string
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Associate conversations with users
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES casio_users(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE casio_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all during dev" ON casio_users 
    FOR ALL TO anon, authenticated USING (true);

-- Update conversation policy to filter by user if possible, but keep it open for now as requested by previous migrations
DROP POLICY IF EXISTS "Allow all for authenticated/anon during dev" ON conversations;
CREATE POLICY "Allow all for authenticated/anon during dev" ON conversations
    FOR ALL TO anon, authenticated USING (true);
