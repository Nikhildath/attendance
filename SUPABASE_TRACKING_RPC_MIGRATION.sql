-- Migration: allow hosted custom-login users to update staff_tracking
-- Run this once on the existing Supabase database.

create table if not exists public.staff_tracking (
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique references public.profiles(id) on delete cascade,
    status text default 'offline' check (status in ('active', 'idle', 'offline')),
    lat numeric default 12.9716,
    lng numeric default 77.5946,
    battery integer default 100,
    current_task text,
    speed_kmh numeric default 0,
    accuracy numeric default 0,
    last_update timestamptz default now(),
    created_at timestamptz default now()
);

alter table public.staff_tracking
    add column if not exists accuracy numeric default 0;

create or replace function public.upsert_staff_tracking(
    p_id uuid,
    p_lat numeric,
    p_lng numeric,
    p_battery integer default 100,
    p_speed_kmh numeric default 0,
    p_accuracy numeric default 0,
    p_current_task text default null,
    p_status text default 'active',
    p_email text default null,
    p_name text default null
)
returns boolean as $$
begin
  -- Ensure profile exists before tracking to prevent FK violations
  insert into public.profiles (id, email, name, role)
  values (
    p_id, 
    coalesce(p_email, p_id::text || '@pending.local'), 
    coalesce(p_name, 'Pending User'), 
    'Employee'
  )
  on conflict (id) do nothing;
  insert into public.staff_tracking (
    user_id,
    lat,
    lng,
    battery,
    speed_kmh,
    accuracy,
    current_task,
    status,
    last_update
  )
  values (
    p_id,
    p_lat,
    p_lng,
    coalesce(p_battery, 100),
    coalesce(p_speed_kmh, 0),
    coalesce(p_accuracy, 0),
    p_current_task,
    coalesce(p_status, 'active'),
    now()
  )
  on conflict (user_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    battery = excluded.battery,
    speed_kmh = excluded.speed_kmh,
    accuracy = excluded.accuracy,
    current_task = excluded.current_task,
    status = excluded.status,
    last_update = now();

  return true;
end;
$$ language plpgsql security definer;

grant execute on function public.upsert_staff_tracking(uuid, numeric, numeric, integer, numeric, numeric, text, text, text, text)
to postgres, anon, authenticated, service_role;
