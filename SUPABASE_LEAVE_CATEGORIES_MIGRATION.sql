-- Migration: editable leave categories
-- Run this once on an existing Supabase database.

create table if not exists public.leave_categories (
    id uuid primary key default gen_random_uuid(),
    name text unique not null,
    annual_allowance numeric default 0,
    is_paid boolean default true,
    is_active boolean default true,
    sort_order integer default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

do $$
declare
    constraint_name text;
begin
    select con.conname
    into constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = connamespace
    where nsp.nspname = 'public'
      and rel.relname = 'leaves'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%Casual%'
    limit 1;

    if constraint_name is not null then
        execute format('alter table public.leaves drop constraint %I', constraint_name);
    end if;
end $$;

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_leave_categories_updated_at on public.leave_categories;
create trigger update_leave_categories_updated_at
before update on public.leave_categories
for each row execute procedure public.update_updated_at_column();

alter table public.leave_categories disable row level security;

grant all on public.leave_categories to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

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
