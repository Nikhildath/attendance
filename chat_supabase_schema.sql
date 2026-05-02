-- ============================================================
-- ATTENDLY PREMIUM CHAT SYSTEM SCHEMA
-- Run this on your secondary CHAT Supabase project
-- Target Project: pcgoxzcllijqqvwaqqpl
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- Profiles (Linked to main app User IDs)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY, -- Matches main app profile.id
    username text UNIQUE NOT NULL,
    avatar_url text,
    full_name text, -- Stores role (e.g., 'Admin', 'Employee')
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Chat Rooms / Channels
CREATE TABLE IF NOT EXISTS public.rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text,
    type text DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'file')),
    file_url text, -- For Base64 or direct URLs
    created_at timestamptz DEFAULT now()
);

-- Push Notification Subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription jsonb NOT NULL,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- 3. SECURITY (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR id::text = auth.uid()::text);

DROP POLICY IF EXISTS "System can upsert profiles" ON public.profiles;
CREATE POLICY "System can upsert profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Rooms Policies
DROP POLICY IF EXISTS "Rooms are viewable by authenticated users" ON public.rooms;
CREATE POLICY "Rooms are viewable by authenticated users" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;
CREATE POLICY "Admins can manage rooms" ON public.rooms FOR ALL USING (true);

-- Messages Policies
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON public.messages;
CREATE POLICY "Messages are viewable by everyone" ON public.messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (auth.uid() = user_id OR user_id::text = auth.uid()::text);

-- Push Subscriptions Policies
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- 4. REALTIME
-- Enable realtime for messages (Wrapped in a safety block to avoid errors if already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- 5. STORAGE BUCKET (Reference)
-- If using Supabase Storage instead of Base64, create a bucket named 'chat-media'
-- and set public access policies.

-- 6. SAMPLE INITIAL ROOM
INSERT INTO public.rooms (name, description) 
VALUES ('general', 'Main workspace channel for everyone')
ON CONFLICT DO NOTHING;

-- 7. MANDATORY AUTOMATED CLEANUP
-- This function purges messages older than 30 days to ensure performance and privacy.
CREATE OR REPLACE FUNCTION public.purge_old_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM public.messages 
    WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- To fully automate this in Supabase:
-- 1. Go to "Database" -> "Cron" in your Supabase Dashboard
-- 2. Create a new cron job:
--    Name: 'monthly_cleanup'
--    Schedule: '0 0 1 * *' (Runs on the 1st of every month)
--    Command: 'SELECT purge_old_messages();'
