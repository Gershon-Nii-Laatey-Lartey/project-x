-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT DEFAULT 'CASIO AI',
    content TEXT DEFAULT ''
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all for now (development)
CREATE POLICY "Allow all for authenticated/anon during dev" ON chats
    FOR ALL
    TO anon, authenticated
    USING (true);
