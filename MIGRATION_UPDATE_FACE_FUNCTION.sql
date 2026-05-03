-- Migration: Upgrade face registration to support multiple embeddings (Multi-Descriptor)
-- Run this in your Supabase SQL Editor

-- 1. Drop the old version if it exists
DROP FUNCTION IF EXISTS public.update_own_face(uuid, float8[]);

-- 2. Create the upgraded RPC function that accepts JSONB (for 2D arrays)
CREATE OR REPLACE FUNCTION public.update_own_face(
    p_id uuid,
    p_descriptor jsonb
)
RETURNS boolean AS $$
BEGIN
  UPDATE public.profiles
  SET 
    face_descriptor = p_descriptor,
    face_registered = true,
    updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.update_own_face(uuid, jsonb)
TO postgres, anon, authenticated, service_role;

-- 4. Verify
SELECT 'Function update_own_face upgraded to support Multi-Descriptors' AS status;
