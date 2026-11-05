-- Phase 1a / Task 5: append-only audit log (FIN-6, GOV-2).
--
-- A trigger records every insert, update and delete on workspaces, accounts,
-- categories and transactions with before/after snapshots. Ledger entries are
-- derived from the transaction header, so the header's history is enough to
-- reconstruct them. Rows can be added only by the trigger and never changed.

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,          -- no FK: history outlives deleted users
  workspace_id uuid,      -- no FK: history outlives deleted workspaces
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('insert', 'update', 'delete', 'void')),
  before jsonb,
  after jsonb,
  source text,
  reason text
);

create index audit_log_workspace_idx on public.audit_log (workspace_id, occurred_at);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_after, v_before);
  v_action text := lower(tg_op);
begin
  if tg_table_name = 'transactions' and tg_op = 'UPDATE'
     and v_before->>'status' = 'posted' and v_after->>'status' = 'void' then
    v_action := 'void';
  end if;

  insert into public.audit_log (actor_id, workspace_id, table_name, row_id, action, before, after, source, reason)
  values (
    (select auth.uid()),
    case when tg_table_name = 'workspaces' then (v_row->>'id')::uuid
         else (v_row->>'workspace_id')::uuid end,
    tg_table_name,
    (v_row->>'id')::uuid,
    v_action,
    v_before,
    v_after,
    v_row->>'source',
    nullif(current_setting('kara.audit_reason', true), '')
  );
  return null;
end;
$$;

create trigger workspaces_audit after insert or update or delete on public.workspaces
  for each row execute function private.audit_row();
create trigger accounts_audit after insert or update or delete on public.accounts
  for each row execute function private.audit_row();
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit_row();
create trigger transactions_audit after insert or update or delete on public.transactions
  for each row execute function private.audit_row();

-- Append-only: refuse changes even from roles that hold table privileges.
create or replace function private.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function private.audit_log_immutable();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.audit_log_immutable();

-- Only the audit trigger (running as the table owner) may add rows.
revoke insert, update, delete, truncate on public.audit_log from public, anon, authenticated, service_role;

revoke all on all functions in schema private from public, anon, authenticated;
