-- ============================================================
--  Studio OS — Migration v5
--  Adds the ACCOUNTING module (CEO + Accountant):
--   • new 'accountant' role
--   • income / expense ledger (acc_transactions)
--   • invoices
--   • realtime sync + schema reload
--  Run in: Supabase -> SQL Editor -> New query -> Run.
--  (All policies use role::text so this is safe to run in one go.)
-- ============================================================

-- 1) New role
alter type user_role add value if not exists 'accountant';

-- 2) Helper: who can see accounting (CEO + Accountant)
create or replace function sees_accounting() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text in ('ceo','accountant'))
$$;

-- 3) Transactions ledger (income + expense)
create table if not exists acc_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_date date not null default current_date,
  kind text not null,                    -- income | expense
  category text default 'Other',
  description text default '',
  amount numeric not null default 0,     -- always positive
  method text default 'bank',            -- bank | cash | benefit | other
  client_id uuid references clients(id) on delete set null,
  invoice_id uuid,
  notes text default '',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table acc_transactions enable row level security;
drop policy if exists p_acc_tx_all on acc_transactions;
create policy p_acc_tx_all on acc_transactions for all to authenticated
  using ( sees_accounting() ) with check ( sees_accounting() );

-- 4) Invoices
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  client_id uuid references clients(id) on delete set null,
  client_name text default '',
  issue_date date not null default current_date,
  due_date date,
  amount numeric not null default 0,
  status text default 'sent',            -- draft | sent | paid | overdue
  notes text default '',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table invoices enable row level security;
drop policy if exists p_invoices_all on invoices;
create policy p_invoices_all on invoices for all to authenticated
  using ( sees_accounting() ) with check ( sees_accounting() );

-- 5) Instant sync
do $$
declare t text;
begin
  foreach t in array array['acc_transactions','invoices']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when others then null;
    end;
  end loop;
end $$;

-- 6) Refresh PostgREST so the new tables are visible immediately
notify pgrst, 'reload schema';
