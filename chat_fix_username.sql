-- FIX: Remove UNIQUE constraint on username to prevent duplicate key errors.
-- The same main-app user can get different anonymous auth IDs across sessions,
-- so username must NOT be unique-constrained.
-- Run this in the CHAT Supabase project SQL Editor.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;

-- Also add an is_admin column if missing (used for admin features in chat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
