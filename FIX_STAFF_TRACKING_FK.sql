-- Fix the foreign key constraint on staff_tracking to point to public.profiles
-- Run this in the Supabase SQL Editor

-- 1. Drop the existing foreign key constraint
ALTER TABLE public.staff_tracking DROP CONSTRAINT IF EXISTS staff_tracking_user_id_fkey;

-- 2. Add the correct foreign key constraint to point to public.profiles instead of auth.users
ALTER TABLE public.staff_tracking 
  ADD CONSTRAINT staff_tracking_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- 3. Also fix profiles foreign key constraint if it references auth.users (to support custom sessions)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 4. Fix admin_list_users RPC if it's causing 400 errors
CREATE OR REPLACE FUNCTION public.admin_list_users(caller_id uuid)
RETURNS SETOF public.profiles AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') THEN
    RETURN QUERY SELECT * FROM public.profiles;
  ELSE
    RETURN QUERY SELECT * FROM public.profiles WHERE id = caller_id; -- Return just self instead of error 400
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
