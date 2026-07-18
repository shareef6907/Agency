create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  city text default '',
  industry text default 'Other',
  phone text default '',
  whatsapp text default '',
  email text default '',
  website text default '',
  instagram text default '',
  address text default '',
  source text default 'manual',
  google_place_id text unique,
  status text default 'new',
  assigned_to uuid references profiles(id),
  follow_up_date date,
  last_contacted_at timestamptz,
  contact_count int default 0,
  converted_client_id uuid references clients(id) on delete set null,
  notes text default '',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table prospects enable row level security;
drop policy if exists p_prospects_all on prospects;
create policy p_prospects_all on prospects for all to authenticated
  using ( exists (select 1 from profiles where id = auth.uid() and role::text in ('ceo','sales_manager')) )
  with check ( exists (select 1 from profiles where id = auth.uid() and role::text in ('ceo','sales_manager')) );
alter publication supabase_realtime add table prospects;
notify pgrst, 'reload schema';
