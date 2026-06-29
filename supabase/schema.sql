-- ============================================================
--  STUDIO OS — Database schema for Supabase
--  Run this whole file in: Supabase -> SQL Editor -> New query -> Run
-- ============================================================

-- ---------- ROLES ----------
do $$ begin
  create type user_role as enum ('ceo','sales_manager','account_manager','editor');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (extends auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role user_role not null default 'editor',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- helper: current user's role
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_ceo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'ceo')
$$;

-- can this user see finance/payments? (ceo + sales_manager)
create or replace function sees_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('ceo','sales_manager'))
$$;

-- ---------- CLIENTS ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text default '',
  designation text default '',
  email text default '',
  phone text default '',
  package_tier text default 'starter',          -- starter | growth | premium | custom
  monthly_fee numeric default 0,
  start_date date,
  end_date date,                                 -- contract end date
  status text default 'active',                  -- active | paused | churned
  platforms text[] default '{}',
  assigned_to uuid references profiles(id),
  notes text default '',
  created_at timestamptz not null default now()
);

-- ---------- SALES VISITS (the sales manager's daily log) ----------
create table if not exists sales_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null default current_date,
  company_name text not null,
  contact_person text default '',
  designation text default '',
  email text default '',
  phone text default '',
  comments text default '',
  status text default 'potential',               -- interested | not_interested | potential
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);


-- ---------- MEETINGS (scheduled future + past meetings) ----------
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text default '',
  meeting_at timestamptz not null,
  type text default 'meeting',                   -- meeting | call | visit
  comments text default '',
  outcome text default '',
  status text default 'scheduled',               -- scheduled | done | cancelled
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- TASKS ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  assigned_to uuid references profiles(id),
  client_id uuid references clients(id) on delete set null,
  status text default 'todo',                    -- todo | in_progress | done
  priority text default 'normal',                -- low | normal | high
  due_date date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- PAYMENTS ----------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  amount numeric not null default 0,
  period text default '',                        -- e.g. "2026-07"
  due_date date,
  status text default 'pending',                 -- paid | pending | overdue
  paid_date date,
  notes text default '',
  created_at timestamptz not null default now()
);

-- ---------- MONTHLY COSTS (for the finance dashboard) ----------
create table if not exists costs (
  id uuid primary key default gen_random_uuid(),
  month text not null,                           -- "2026-07"
  label text not null,
  amount numeric not null default 0,
  category text default 'other',                 -- salary | rent | electricity | subscriptions | other
  created_at timestamptz not null default now()
);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table profiles      enable row level security;
alter table clients       enable row level security;
alter table sales_visits  enable row level security;
alter table meetings      enable row level security;
alter table tasks         enable row level security;
alter table payments      enable row level security;
alter table costs         enable row level security;

-- PROFILES: everyone signed-in can read names (needed for assignment dropdowns); only CEO writes
drop policy if exists p_profiles_read on profiles;
create policy p_profiles_read on profiles for select to authenticated using (true);
drop policy if exists p_profiles_write on profiles;
create policy p_profiles_write on profiles for all to authenticated using (is_ceo()) with check (is_ceo());

-- CLIENTS: CEO + sales_manager see all; account_manager/editor see only clients assigned to them
drop policy if exists p_clients_read on clients;
create policy p_clients_read on clients for select to authenticated
  using ( my_role() in ('ceo','sales_manager') or assigned_to = auth.uid() );
drop policy if exists p_clients_write on clients;
drop policy if exists p_clients_insert on clients;
create policy p_clients_insert on clients for insert to authenticated
  with check ( my_role() in ('ceo','sales_manager') );
drop policy if exists p_clients_update on clients;
create policy p_clients_update on clients for update to authenticated
  using ( my_role() in ('ceo','sales_manager') )
  with check ( my_role() in ('ceo','sales_manager') );
drop policy if exists p_clients_delete on clients;
create policy p_clients_delete on clients for delete to authenticated
  using ( is_ceo() );   -- only the CEO can delete clients

-- SALES VISITS: CEO + sales_manager see all; others none. Creator can write own; CEO writes all
drop policy if exists p_visits_read on sales_visits;
create policy p_visits_read on sales_visits for select to authenticated
  using ( my_role() in ('ceo','sales_manager') );
drop policy if exists p_visits_write on sales_visits;
create policy p_visits_write on sales_visits for all to authenticated
  using ( my_role() in ('ceo','sales_manager') )
  with check ( my_role() in ('ceo','sales_manager') );

-- MEETINGS: CEO + sales_manager
drop policy if exists p_meetings_all on meetings;
create policy p_meetings_all on meetings for all to authenticated
  using ( my_role() in ('ceo','sales_manager') )
  with check ( my_role() in ('ceo','sales_manager') );

-- TASKS: CEO + account_manager see/manage all; editors see + update their own assigned tasks
drop policy if exists p_tasks_read on tasks;
create policy p_tasks_read on tasks for select to authenticated
  using ( my_role() in ('ceo','account_manager') or assigned_to = auth.uid() );
drop policy if exists p_tasks_insert on tasks;
create policy p_tasks_insert on tasks for insert to authenticated
  with check ( my_role() in ('ceo','account_manager') );
drop policy if exists p_tasks_update on tasks;
create policy p_tasks_update on tasks for update to authenticated
  using ( my_role() in ('ceo','account_manager') or assigned_to = auth.uid() );
drop policy if exists p_tasks_delete on tasks;
create policy p_tasks_delete on tasks for delete to authenticated
  using ( my_role() in ('ceo','account_manager') );

-- PAYMENTS: CEO + sales_manager only
drop policy if exists p_payments_all on payments;
create policy p_payments_all on payments for all to authenticated
  using ( sees_finance() ) with check ( sees_finance() );

-- COSTS: CEO + sales_manager only
drop policy if exists p_costs_all on costs;
create policy p_costs_all on costs for all to authenticated
  using ( sees_finance() ) with check ( sees_finance() );

-- ============================================================
--  AUTO-CREATE a profile row whenever an auth user is created
--  (role + name are passed in raw_user_meta_data by the admin API)
-- ============================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce((new.raw_user_meta_data->>'role')::user_role,'editor')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
--  DONE. Next: create your first CEO user (see README step 3).
-- ============================================================
