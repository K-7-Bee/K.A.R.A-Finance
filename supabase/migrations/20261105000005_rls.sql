-- Phase 1a / Task 6: row-level security and least-privilege grants (SEC-1).
--
-- Start from nothing, then grant back exactly what the app needs:
--   * anon: no table access at all
--   * authenticated: read own rows; a few safe column updates; ledger writes
--     only through the posting service (GOV-1)

-- Supabase grants everything on new public objects to anon and authenticated by
-- default. Stop that, so every future table and function needs explicit grants.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- RLS policies call this, so the authenticated role needs to reach it.
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;

alter table public.currencies enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_log enable row level security;

-- currencies: reference data
grant select on public.currencies to authenticated;
create policy currencies_read on public.currencies
  for select to authenticated using (true);

-- profiles: own row
grant select on public.profiles to authenticated;
grant update (display_name, timezone) on public.profiles to authenticated;
create policy profiles_read_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces: owner reads; may rename and change timezone
grant select on public.workspaces to authenticated;
grant update (name, timezone) on public.workspaces to authenticated;
create policy workspaces_read_own on public.workspaces
  for select to authenticated using (owner_id = (select auth.uid()));
create policy workspaces_update_own on public.workspaces
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- accounts: created via create_account; owner may rename or archive.
-- type and currency are fixed after creation.
grant select on public.accounts to authenticated;
grant update (name, is_archived) on public.accounts to authenticated;
create policy accounts_read_own on public.accounts
  for select to authenticated using (private.is_workspace_owner(workspace_id));
create policy accounts_update_own on public.accounts
  for update to authenticated
  using (private.is_workspace_owner(workspace_id))
  with check (private.is_workspace_owner(workspace_id));

-- categories: owner manages non-system rows; no deletes (archive instead).
-- is_system and system_key are not grantable, so users can only create
-- ordinary income/expense categories (equity requires is_system).
grant select on public.categories to authenticated;
grant insert (workspace_id, name, kind, parent_id) on public.categories to authenticated;
grant update (name, parent_id, is_archived) on public.categories to authenticated;
create policy categories_read_own on public.categories
  for select to authenticated using (private.is_workspace_owner(workspace_id));
create policy categories_insert_own on public.categories
  for insert to authenticated
  with check (private.is_workspace_owner(workspace_id) and not is_system);
create policy categories_update_own on public.categories
  for update to authenticated
  using (private.is_workspace_owner(workspace_id) and not is_system)
  with check (private.is_workspace_owner(workspace_id) and not is_system);

-- transactions, ledger_entries, audit_log: read-only. Writes go through the
-- posting service functions (SECURITY DEFINER) and the audit trigger.
grant select on public.transactions to authenticated;
create policy transactions_read_own on public.transactions
  for select to authenticated using (private.is_workspace_owner(workspace_id));

grant select on public.ledger_entries to authenticated;
create policy ledger_entries_read_own on public.ledger_entries
  for select to authenticated using (private.is_workspace_owner(workspace_id));

grant select on public.audit_log to authenticated;
create policy audit_log_read_own on public.audit_log
  for select to authenticated using (private.is_workspace_owner(workspace_id));
