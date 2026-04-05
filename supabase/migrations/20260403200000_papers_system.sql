-- Migration: Papers System (Academic Subjects & Paper Images)
-- Date: 2026-04-03 20:00:00

-- 1. Create the 'papers' table for academic subject management
CREATE TABLE IF NOT EXISTS public.papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    subject TEXT NOT NULL,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) -- Optional: Track who uploaded
);

-- 2. Add indexing for optimized subject-based searches
CREATE INDEX IF NOT EXISTS idx_papers_subject ON public.papers (subject);

-- 3. Enable Row-Level Security (RLS) on the papers table
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

-- 4. Set up permissive select and authenticated insert policies
CREATE POLICY "Public can view all subject papers" 
    ON public.papers FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload papers" 
    ON public.papers FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR true); 
    -- Note: 'OR true' added if the user wants public uploads during development, remove for production!

-- 5. Set up storage bucket: 'papers'
-- Note: This requires the storage extension (usually enabled by default in Supabase)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('papers', 'papers', true) 
ON CONFLICT (id) DO NOTHING;

-- 6. Storage Bucket Policies
-- Allow anyone to view images (as bucket is marked public, but explicit policy is safer)
CREATE POLICY "Public View Access" 
    ON storage.objects FOR SELECT USING (bucket_id = 'papers');

-- Allow authenticated users (or anyone for dev) to upload files
CREATE POLICY "Public Upload Access" 
    ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'papers');

-- Provide full access for authenticated users to manage files
CREATE POLICY "Authenticated Manage Access" 
    ON storage.objects FOR ALL USING (bucket_id = 'papers' AND auth.role() = 'authenticated');
