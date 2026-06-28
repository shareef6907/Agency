-- ============================================================
--  Studio OS — Migration v2
--  Adds: contract end date + CEO-only client deletion
--  Run in Supabase -> SQL Editor -> New query -> Run
-- ============================================================

-- 1. Contract end date
alter table clients add column if not exists end_date date;

-- 2. CEO-only delete (replace the broad write policy with granular ones)
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
