-- Migration: Add Biometric Support to Profiles
-- Run this in your Supabase SQL Editor

-- 1. Add columns to profiles table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='biometric_registered') THEN
        ALTER TABLE public.profiles ADD COLUMN biometric_registered boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='biometric_credential_id') THEN
        ALTER TABLE public.profiles ADD COLUMN biometric_credential_id text;
    END IF;
END $$;

-- 2. Update check_credentials function to return biometric status
-- Drop old version first to avoid return type mismatch
DROP FUNCTION IF EXISTS public.check_credentials(text, text);

CREATE OR REPLACE FUNCTION public.check_credentials(p_email text, p_password text)
RETURNS TABLE (
    id uuid, 
    email text, 
    name text, 
    role text, 
    dept text, 
    face_registered boolean, 
    biometric_registered boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.email, p.name, p.role, p.dept, p.face_registered, p.biometric_registered
    FROM public.profiles p
    WHERE p.email = p_email AND p.password = p_password
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.check_credentials(text, text) TO postgres, anon, authenticated, service_role;

-- 3. Update existing profiles (optional, already handled by DEFAULT false)
-- UPDATE public.profiles SET biometric_registered = false WHERE biometric_registered IS NULL;

SELECT 'Biometric migration applied successfully' as status;
