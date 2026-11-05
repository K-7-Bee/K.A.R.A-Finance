-- Phase 1c / Task 1: add, change or remove an account's opening balance after
-- the account was created. Part of the posting service (GOV-1): the only way
-- to write opening_balance transactions besides create_account.
--
--   amount <> 0, none exists  -> post a new opening_balance transaction
--   amount <> 0, one exists   -> update it in place and rebuild its entries
--   amount =  0, one exists   -> void it (kept for the audit trail)
--   amount =  0, none exists  -> nothing to do
--
-- The amount is the signed effect on the account: negative for money owed
-- (credit cards, overdrafts). The date is local midnight in the workspace
-- timezone; when omitted it keeps the existing date, or uses today.

create or replace function public.set_opening_balance(
  p_account_id uuid,
  p_amount bigint,
  p_opening_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.accounts%rowtype;
  w public.workspaces%rowtype;
  t public.transactions%rowtype;
  v_occurred_at timestamptz;
  v_id uuid;
begin
  -- Lock the account so concurrent edits of its opening balance serialise.
  select * into a from public.accounts where id = p_account_id for update;
  if not found or not private.is_workspace_owner(a.workspace_id) then
    perform private.require_workspace_owner(null);
  end if;
  if a.is_archived then
    raise exception 'account "%" is archived', a.name using errcode = '22023';
  end if;
  if p_amount is null or abs(p_amount) > 1000000000000000 then
    raise exception 'opening balance is missing or too large' using errcode = '22023';
  end if;

  select * into w from public.workspaces where id = a.workspace_id;

  select * into t
    from public.transactions
   where account_id = a.id and type = 'opening_balance' and status = 'posted'
   order by created_at
   limit 1
   for update;

  if p_opening_date is not null then
    v_occurred_at := p_opening_date::timestamp at time zone w.timezone;
  elsif t.id is not null then
    v_occurred_at := t.occurred_at;
  else
    v_occurred_at := (now() at time zone w.timezone)::date::timestamp at time zone w.timezone;
  end if;

  if p_amount = 0 then
    if t.id is null then
      return null;
    end if;
    perform set_config('kara.audit_reason', 'Opening balance removed', true);
    delete from public.ledger_entries where transaction_id = t.id;
    update public.transactions set status = 'void' where id = t.id;
    perform set_config('kara.audit_reason', '', true);
    return null;
  end if;

  if t.id is not null then
    delete from public.ledger_entries where transaction_id = t.id;
    update public.transactions
       set amount = p_amount, occurred_at = v_occurred_at
     where id = t.id;
    perform private.build_entries(t.id);
    return t.id;
  end if;

  insert into public.transactions (
    workspace_id, type, occurred_at, currency, amount, account_id, category_id, description, created_by
  )
  select a.workspace_id, 'opening_balance', v_occurred_at, a.currency, p_amount, a.id, c.id,
         'Opening balance', (select auth.uid())
    from public.categories c
   where c.workspace_id = a.workspace_id and c.system_key = 'opening_balance'
  returning id into v_id;

  perform private.build_entries(v_id);
  return v_id;
end;
$$;

revoke execute on function public.set_opening_balance(uuid, bigint, date) from public, anon;
grant execute on function public.set_opening_balance(uuid, bigint, date) to authenticated;
