  -- Attendly Pro: Full Database Schema
  -- Use this file to set up a new Supabase project.

  -- 1. EXTENSIONS
  create extension if not exists "uuid-ossp";

  -- 2. TABLES

  -- Branches
  create table public.branches (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      city text not null,
      country text not null default 'India',
      address text,
      timezone text default 'Asia/Kolkata',
      currency text default 'INR',
      employees_count integer default 0,
      lat numeric,
      lng numeric,
      radius_meters integer default 150,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
  );

  -- Profiles (linked to auth.users)
  create table public.profiles (
      id uuid primary key references auth.users on delete cascade,
      email text unique not null,
      name text not null,
      role text not null default 'Employee' check (role in ('Employee', 'Manager', 'Admin')),
      dept text,
      face_registered boolean default false,
      face_descriptor jsonb,
      password text, -- For custom login bypass if needed
      branch_id uuid references public.branches(id) on delete set null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
  );

  -- Attendance
  create table public.attendance (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      check_in timestamptz,
      check_out timestamptz,
      location_lat numeric,
      location_lng numeric,
      branch_id uuid references public.branches(id) on delete set null,
      status text default 'present' check (status in ('present', 'absent', 'late', 'leave', 'holiday')),
      notes text,
      created_at timestamptz default now()
  );

  -- Leaves
  create table public.leaves (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      type text not null,
      from_date date not null,
      to_date date not null,
      days numeric not null,
      half_day boolean default false,
      status text default 'Pending' check (status in ('Approved', 'Pending', 'Rejected')),
      reason text,
      approved_by uuid references public.profiles(id),
      created_at timestamptz default now()
  );

  -- Leave Categories
  create table public.leave_categories (
      id uuid primary key default gen_random_uuid(),
      name text unique not null,
      annual_allowance numeric default 0,
      is_paid boolean default true,
      is_active boolean default true,
      sort_order integer default 0,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
  );

  -- Organisation Settings
  create table public.organisation_settings (
      id integer primary key default 1 check (id = 1),
      company_name text default 'Attendly Pro',
      logo_url text,
      default_currency text default 'INR',
      timezone text default 'Asia/Kolkata',
      country_code text default 'IN',
      late_threshold_mins integer default 15,
      late_fine_amount numeric default 50,
      working_hours_per_day numeric default 9,
      fiscal_year_start date default '2024-04-01',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
  );

  -- Staff Tracking
  create table public.staff_tracking (
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

  -- Shifts
  create table public.shifts (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      type text default 'fixed' check (type in ('fixed', 'rotational', 'open')),
      start_time text,
      end_time text,
      break_minutes integer default 60,
      color text default 'bg-primary/10 text-primary border-primary/30',
      created_at timestamptz default now()
  );

  -- Shift Schedule
  create table public.shift_schedule (
      id uuid primary key default gen_random_uuid(),
      user_id uuid unique references public.profiles(id) on delete cascade,
      mon uuid references public.shifts(id),
      tue uuid references public.shifts(id),
      wed uuid references public.shifts(id),
      thu uuid references public.shifts(id),
      fri uuid references public.shifts(id),
      sat uuid references public.shifts(id),
      sun uuid references public.shifts(id),
      created_at timestamptz default now()
  );

  -- Company Holidays
  create table public.company_holidays (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      date date not null,
      kind text default 'public' check (kind in ('public', 'restricted', 'optional')),
      region text default 'All',
      branch_id uuid references public.branches(id),
      created_at timestamptz default now()
  );

  -- Payslips
  create table public.payslips (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references public.profiles(id) on delete cascade,
      month text not null,
      basic_pay numeric default 0,
      hra numeric default 0,
      allowances numeric default 0,
      bonus numeric default 0,
      overtime_pay numeric default 0,
      fines numeric default 0,
      loan_deduction numeric default 0,
      tax numeric default 0,
      net_payable numeric default 0,
      status text default 'Pending' check (status in ('Paid', 'Pending', 'Processing')),
      created_at timestamptz default now()
  );

  -- Comp-Off Requests
  create table public.comp_off_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references public.profiles(id) on delete cascade,
      worked_on date not null,
      days numeric default 1,
      reason text,
      status text default 'Pending' check (status in ('Approved', 'Pending', 'Rejected')),
      created_at timestamptz default now()
  );

  -- Financial Requests (Advances/Loans)
  create table public.financial_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references public.profiles(id) on delete cascade,
      kind text not null check (kind in ('Advance', 'Loan', 'Allowance', 'Bonus')),
      amount numeric not null,
      emi_months integer,
      reason text,
      status text default 'Pending' check (status in ('Approved', 'Pending', 'Rejected')),
      created_at timestamptz default now()
  );

  -- 3. FUNCTIONS & RPCs

  -- Helper: Check if user is Admin
  create or replace function public.is_admin()
  returns boolean as $$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Admin'
    );
  END;
  $$ language plpgsql security definer set search_path = public, extensions;

  -- Helper: Check if user is Manager
  create or replace function public.is_manager()
  returns boolean as $$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Manager'
    );
  END;
  $$ language plpgsql security definer set search_path = public, extensions;

  -- RPC: Custom Login Check (Bypasses Auth if needed)
  create or replace function public.check_credentials(p_email text, p_password text)
  returns table (id uuid, email text, name text, role text, dept text, face_registered boolean) as $$
  BEGIN
    RETURN QUERY
    SELECT p.id, p.email, p.name, p.role, p.dept, p.face_registered
    FROM public.profiles p
    WHERE p.email = p_email AND p.password = p_password
    LIMIT 1;
  END;
  $$ language plpgsql security definer set search_path = public, extensions;

  -- RPC: Admin List Users
  create or replace function public.admin_list_users(caller_id uuid)
  returns setof public.profiles as $$
  BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') THEN
      RETURN QUERY SELECT * FROM public.profiles;
    ELSE
      RAISE EXCEPTION 'Access Denied';
    END IF;
  END;
  $$ language plpgsql security definer set search_path = public, extensions;

  -- RPC: Admin Update Profile
  create or replace function public.admin_update_profile(
      caller_id uuid, 
      p_id uuid, 
      p_name text,
      p_role text, 
      p_dept text, 
      p_password text, 
      p_face boolean,
      p_branch_id uuid default null
  )
  returns void as $$
  BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') THEN
      UPDATE public.profiles
      SET 
        name = p_name,
        role = p_role, 
        dept = p_dept, 
        password = p_password, 
        face_registered = p_face, 
        branch_id = p_branch_id,
        updated_at = NOW()
      WHERE id = p_id;
    ELSE
      RAISE EXCEPTION 'Access Denied';
    END IF;
  END;
  $$ language plpgsql security definer set search_path = public, extensions;

  -- RPC: Admin Delete Profile
  create or replace function public.admin_delete_profile(caller_id uuid, p_id uuid)
  returns void as $$
  BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') AND caller_id <> p_id THEN
      DELETE FROM public.profiles WHERE id = p_id;
    ELSE
      RAISE EXCEPTION 'Access Denied or Self-Deletion Attempt';
    END IF;
  END;
  $$ language plpgsql security definer set search_path = public, extensions;

  -- RPC: Admin Insert Profile
  create or replace function public.admin_insert_profile(
      caller_id uuid,
      p_id uuid,
      p_email text,
      p_name text,
      p_role text,
      p_dept text,
      p_password text
  )
  returns jsonb as $$
  DECLARE
    auth_user_exists boolean;
  BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'Admin') THEN
      RAISE EXCEPTION 'Access Denied';
    END IF;

    -- Check if auth.users entry exists for this UUID
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_id) INTO auth_user_exists;

    IF NOT auth_user_exists THEN
      -- Insert into auth.users first so FK constraint on profiles.id is satisfied
      INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
      ) VALUES (
        p_id, p_email,
        crypt(p_password, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_name),
        'authenticated', 'authenticated'
      );
    END IF;

    -- Now safely insert the profile
    INSERT INTO public.profiles (id, email, name, role, dept, password)
    VALUES (p_id, p_email, p_name, p_role, p_dept, p_password)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      dept = EXCLUDED.dept,
      password = EXCLUDED.password,
      updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'id', p_id);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'A user with this email already exists';
    WHEN OTHERS THEN
      RAISE EXCEPTION '%', SQLERRM;
  END;
  $$ language plpgsql security definer set search_path = public, auth, extensions;

  -- RPC: Upsert Staff Tracking
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
  $$ language plpgsql security definer set search_path = public;

  grant execute on function public.upsert_staff_tracking(uuid, numeric, numeric, integer, numeric, numeric, text, text, text, text)
  to postgres, anon, authenticated, service_role;

  -- RPC: Update Own Face Descriptor
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
  $$ language plpgsql security definer set search_path = public;

  grant execute on function public.update_own_face(uuid, float8[])
  to postgres, anon, authenticated, service_role;

  -- Trigger: Handle New User from Auth
  create or replace function public.handle_new_user()
  returns trigger as $$
  BEGIN
    INSERT INTO public.profiles (id, email, name, role, face_registered)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Employee',
      FALSE
    );
    RETURN NEW;
  END;
  $$ language plpgsql security definer set search_path = public;

  -- 4. TRIGGERS

  -- Sync auth.users with public.profiles
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

  -- Update updated_at columns automatically
  create or replace function public.update_updated_at_column()
  returns trigger as $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ language plpgsql set search_path = public;

  create trigger update_branches_updated_at before update on public.branches for each row execute procedure update_updated_at_column();
  create trigger update_profiles_updated_at before update on public.profiles for each row execute procedure update_updated_at_column();
  create trigger update_organisation_settings_updated_at before update on public.organisation_settings for each row execute procedure update_updated_at_column();
  create trigger update_leave_categories_updated_at before update on public.leave_categories for each row execute procedure update_updated_at_column();

  -- 5. ACCESS CONTROL (RLS DISABLED)
  -- Disabling RLS on all tables to ensure smooth administrative management and prevent policy violations.

  alter table public.profiles disable row level security;
  alter table public.attendance disable row level security;
  alter table public.leaves disable row level security;
  alter table public.leave_categories disable row level security;
  alter table public.branches disable row level security;
  alter table public.organisation_settings disable row level security;
  alter table public.payslips disable row level security;
  alter table public.staff_tracking disable row level security;
  alter table public.shifts disable row level security;
  alter table public.shift_schedule disable row level security;
  alter table public.company_holidays disable row level security;
  alter table public.comp_off_requests disable row level security;
  alter table public.financial_requests disable row level security;

  -- Grant all privileges to all authenticated and anonymous users for this project
  GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

  -- 6. INITIAL DATA

  insert into public.organisation_settings (id, company_name)
  values (1, 'Attendly Pro')
  on conflict (id) do nothing;

  insert into public.branches (name, city, country)
  values ('Main Office', 'Mumbai', 'India')
  on conflict do nothing;

  insert into public.leave_categories (name, annual_allowance, is_paid, is_active, sort_order)
  values
      ('Annual', 20, true, true, 1),
      ('Sick', 10, true, true, 2),
      ('Casual', 8, true, true, 3),
      ('Unpaid', 0, false, true, 4)
  on conflict (name) do update set
      annual_allowance = excluded.annual_allowance,
      is_paid = excluded.is_paid,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;
