-- ============================================================
-- FIX: Duplicate profiles created per device
-- Run this on the CHAT Supabase project SQL Editor
-- (pcgoxzcllijqqvwaqqpl)
-- ============================================================

-- 1. Drop FK constraints that tie profile IDs to auth.users
--    We now use the main app's stable user ID, not anonymous auth IDs
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Update RLS: allow any authenticated user (anonymous auth) to manage profiles
DROP POLICY IF EXISTS "Users can insert own profile." ON profiles;
CREATE POLICY "Authenticated users can insert profiles." ON profiles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Authenticated users can update profiles." ON profiles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own messages." ON messages;
CREATE POLICY "Authenticated users can delete messages." ON messages
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3. Re-add messages FK to profiles (without auth.users chain)
ALTER TABLE messages ADD CONSTRAINT messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Done! Now the app will use the main user's stable ID for profiles.
