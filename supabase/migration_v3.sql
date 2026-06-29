-- ============================================================
--  Studio OS — Migration v3
--  Fixes client saving, enforces CEO-only client delete,
--  and turns on INSTANT SYNC (realtime) for every table.
--  Run in Supabase -> SQL Editor -> New query -> Run.
--  Safe to run even if you already ran earlier migrations.
-- ============================================================

-- 1. Contract end date (this is what was blocking client saving)
alter table clients add column if not exists end_date date;

-- 2. Correct client permissions: CEO + sales manager add/edit, CEO-only delete
drop policy if exists p_clients_write  on clients;
drop policy if exists p_clients_insert on clients;
drop policy if exists p_clients_update on clients;
drop policy if exists p_clients_delete on clients;

create policy p_clients_insert on clients for insert to authenticated
  with check ( my_role() in ('ceo','sales_manager') );
create policy p_clients_update on clients for update to authenticated
  using ( my_role() in ('ceo','sales_manager') )
  with check ( my_role() in ('ceo','sales_manager') );
create policy p_clients_delete on clients for delete to authenticated
  using ( is_ceo() );   -- only the CEO can delete clients

-- 3. Instant sync — add every table to the realtime publication (idempotent)
do $$
declare t text;
begin
  foreach t in array array['profiles','clients','sales_visits','tasks','payments','costs']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;   -- already enabled, ignore
      when others then null;
    end;
  end loop;
end $$;
