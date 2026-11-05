-- Phase 1b review fix: audit profile changes too (display name, timezone).
-- Profiles have no workspace, so their audit rows carry workspace_id = null and
-- are readable only by operators, not through the app.
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function private.audit_row();
