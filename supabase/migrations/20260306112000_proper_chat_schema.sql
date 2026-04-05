-- Rename chats to conversations for better semantics
ALTER TABLE IF EXISTS chats RENAME TO conversations;

-- Improve existing conversations table
-- Handle default value casting for JSONB conversion
ALTER TABLE conversations ALTER COLUMN content DROP DEFAULT;
ALTER TABLE conversations ALTER COLUMN content TYPE JSONB USING content::jsonb;
ALTER TABLE conversations ALTER COLUMN content SET DEFAULT '[]'::jsonb;

ALTER TABLE conversations 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Create messages table for proper relational storage (optional-ready)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'ai', 'system')),
    content TEXT NOT NULL,
    image TEXT, -- Base64 or URI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Separate logs table (as referenced in INTELLIGENCE_README.md)
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL,
    error_message TEXT,
    error_code TEXT,
    duration_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    api_key_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Development Policies
CREATE POLICY "Allow all for authenticated/anon during dev" ON messages
    FOR ALL TO anon, authenticated USING (true);

CREATE POLICY "Allow all for authenticated/anon during dev" ON chat_logs
    FOR ALL TO anon, authenticated USING (true);
