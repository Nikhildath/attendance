-- Migration: Create update_own_face function and set permissions
-- Run this in your Supabase SQL Editor

-- 1. Create the RPC function
create or replace function public.update_own_face(
    p_id uuid,
    p_descriptor float8[]
)
returns boolean as $$
begin
  update public.profiles
  set 
    face_descriptor = to_jsonb(p_descriptor),
    face_registered = true,
    updated_at = now()
  where id = p_id;

  return true;
end;
$$ language plpgsql security definer;

-- 2. Grant execution permissions to all roles
grant execute on function public.update_own_face(uuid, float8[])
to postgres, anon, authenticated, service_role;

-- 3. Verify
select 'Function update_own_face created successfully' as status;
