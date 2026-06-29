-- ============================================================
--  Studio OS — Migration v4
--  Adds the Meetings feature to the Sales CRM
--  (scheduled future meetings + past meetings with comments).
--  Run in Supabase -> SQL Editor -> New query -> Run.
-- ============================================================

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text default '',
  meeting_at timestamptz not null,
  type text default 'meeting',          -- meeting | call | visit
  comments text default '',
  outcome text default '',
  status text default 'scheduled',       -- scheduled | done | cancelled
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table meetings enable row level security;

drop policy if exists p_meetings_all on meetings;
create policy p_meetings_all on meetings for all to authenticated
  using ( my_role() in ('ceo','sales_manager') )
  with check ( my_role() in ('ceo','sales_manager') );

-- instant sync for meetings
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.meetings';
  exception when duplicate_object then null; when others then null;
  end;
end $$;
