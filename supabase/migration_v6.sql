-- ============================================================
--  Studio OS — Migration v6
--  Adds brought_by to clients for per-person commission attribution.
--  Run in: Supabase -> SQL Editor -> New query -> Run.
-- ============================================================

alter table clients add column if not exists brought_by uuid references profiles(id);

notify pgrst, 'reload schema';
