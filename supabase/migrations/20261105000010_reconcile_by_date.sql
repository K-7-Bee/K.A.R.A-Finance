-- Phase 1c review fixes.
--
-- 1. reconcile_account_on_date: reconcile "as of" a local calendar date. The
--    day boundary is computed here, in SQL, with the same timezone rules the
--    aggregates use, so the app and the database never disagree about where a
--    day ends (month ends, DST gaps at midnight).
--      * today       -> as of now() (the adjustment counts immediately)
--      * past date   -> as of the last instant of that local day
--      * future date -> rejected
--      * before the account's opening balance date -> rejected (would double count)
--
-- 2. Opening balances can't be dated in the future (they would be invisible in
--    current balances until then). Enforced by trigger so every write path,
--    create_account and set_opening_balance included, is covered.

create or replace function public.reconcile_account_on_date(
  p_account_id uuid,
  p_actual_balance bigint,
  p_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.accounts%rowtype;
  v_tz text;
  v_today date;
  v_opening_date date;
  v_as_of timestamptz;
begin
  -- Lock first so a concurrent set_opening_balance can't move the opening date
  -- between this check and the posting below.
  select * into a from public.accounts where id = p_account_id for update;
  if not found or not private.is_workspace_owner(a.workspace_id) then
    perform private.require_workspace_owner(null);
  end if;
  if p_date is null then
    raise exception 'a reconcile date is required' using errcode = '22023';
  end if;

  select timezone into v_tz from public.workspaces where id = a.workspace_id;
  v_today := (now() at time zone v_tz)::date;
  if p_date > v_today then
    raise exception 'reconcile date % is in the future', p_date using errcode = '22023';
  end if;

  select (min(occurred_at) at time zone v_tz)::date into v_opening_date
    from public.transactions
   where account_id = a.id and type = 'opening_balance' and status = 'posted';
  if v_opening_date is not null and p_date < v_opening_date then
    raise exception 'reconcile date % is before the opening date %', p_date, v_opening_date using errcode = '22023';
  end if;

  v_as_of := case
    when p_date = v_today then now()
    else ((p_date + 1)::timestamp at time zone v_tz) - interval '1 microsecond'
  end;

  -- reconcile_account locks the account row and re-checks ownership.
  return public.reconcile_account(p_account_id, p_actual_balance, v_as_of);
end;
$$;

revoke execute on function public.reconcile_account_on_date(uuid, bigint, date) from public, anon;
grant execute on function public.reconcile_account_on_date(uuid, bigint, date) to authenticated;

-- reconcile_account accepts any instant, which would bypass the date checks
-- above. It stays as the internal step called by reconcile_account_on_date
-- (which runs as the function owner), but users can no longer call it.
revoke execute on function public.reconcile_account(uuid, bigint, timestamptz) from authenticated;

create or replace function private.opening_balance_not_in_future()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'opening_balance' and new.status = 'posted' and new.occurred_at > now() then
    raise exception 'the opening date can''t be in the future' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger transactions_opening_not_in_future
  before insert or update of occurred_at, status on public.transactions
  for each row execute function private.opening_balance_not_in_future();

revoke all on function private.opening_balance_not_in_future() from public, anon, authenticated;
