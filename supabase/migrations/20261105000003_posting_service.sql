-- Phase 1a / Task 4: posting service.
--
-- These five functions are the ONLY write path for transactions and
-- ledger_entries (GOV-1). Each runs in the caller's database transaction, so a
-- failure anywhere rolls back every row it wrote (FIN-5). They run as the
-- function owner, so each one checks ownership through auth.uid() itself.
--
--   post_transaction(p jsonb)                 income, expense, transfer
--   update_transaction(id, p jsonb)           edit a posted transaction
--   void_transaction(id, reason)              keep the record, remove its effect
--   create_account(...)                       account + optional opening balance
--   reconcile_account(id, actual, as_of)      post the difference as an adjustment

-- Does the current user own this workspace? Also used by RLS policies.
create or replace function private.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces
     where id = p_workspace_id and owner_id = (select auth.uid())
  );
$$;

create or replace function private.require_workspace_owner(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_workspace_id is null or not private.is_workspace_owner(p_workspace_id) then
    -- Same message whether the workspace is missing or someone else's.
    raise exception 'workspace not found' using errcode = '42501';
  end if;
end;
$$;

-- Parse a JSON amount: a JSON number that is a whole number of minor units.
create or replace function private.parse_amount(p_value jsonb, p_allow_negative boolean default false)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' then
    raise exception 'amount must be a JSON number of minor units' using errcode = '22023';
  end if;
  v := p_value::numeric;
  if v <> trunc(v) then
    raise exception 'amount must be a whole number of minor units' using errcode = '22023';
  end if;
  if v = 0 or (v < 0 and not p_allow_negative) then
    raise exception 'amount must be greater than zero' using errcode = '22023';
  end if;
  if abs(v) > 1000000000000000 then
    raise exception 'amount is too large' using errcode = '22023';
  end if;
  return v::bigint;
end;
$$;

-- Parse an ISO 8601 timestamp that carries an explicit UTC offset (FIN-7).
create or replace function private.parse_occurred_at(p_value text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_value is null
     or p_value !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|z|[+-]\d{2}(:?\d{2})?)$' then
    raise exception 'occurred_at must be an ISO 8601 timestamp with a UTC offset' using errcode = '22023';
  end if;
  return p_value::timestamptz;
end;
$$;

-- Check accounts and category for an income/expense/transfer in a workspace.
-- Returns the transaction currency (the account's currency).
create or replace function private.validate_transaction(
  p_workspace_id uuid,
  p_type public.transaction_type,
  p_account_id uuid,
  p_counter_account_id uuid,
  p_category_id uuid,
  -- Ids already on the transaction being edited: allowed even if archived, so
  -- old records stay editable (e.g. notes) after an account/category is archived.
  p_keep uuid[] default '{}'
)
returns char(3)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.accounts%rowtype;
  ca public.accounts%rowtype;
  c public.categories%rowtype;
begin
  if p_type not in ('income', 'expense', 'transfer') then
    raise exception 'type must be income, expense or transfer' using errcode = '22023';
  end if;

  select * into a from public.accounts where id = p_account_id and workspace_id = p_workspace_id;
  if not found then
    raise exception 'account not found' using errcode = '22023';
  end if;
  if a.is_archived and not a.id = any(p_keep) then
    raise exception 'account "%" is archived', a.name using errcode = '22023';
  end if;

  if p_type = 'transfer' then
    if p_category_id is not null then
      raise exception 'a transfer cannot have a category' using errcode = '22023';
    end if;
    select * into ca from public.accounts where id = p_counter_account_id and workspace_id = p_workspace_id;
    if not found then
      raise exception 'destination account not found' using errcode = '22023';
    end if;
    if ca.id = a.id then
      raise exception 'a transfer needs two different accounts' using errcode = '22023';
    end if;
    if ca.is_archived and not ca.id = any(p_keep) then
      raise exception 'account "%" is archived', ca.name using errcode = '22023';
    end if;
    if ca.currency <> a.currency then
      raise exception 'transfers between currencies (% to %) are not supported yet', a.currency, ca.currency
        using errcode = '22023';
    end if;
  else
    if p_counter_account_id is not null then
      raise exception 'only transfers have a destination account' using errcode = '22023';
    end if;
    select * into c from public.categories where id = p_category_id and workspace_id = p_workspace_id;
    if not found then
      raise exception 'category not found' using errcode = '22023';
    end if;
    if c.is_archived and not c.id = any(p_keep) then
      raise exception 'category "%" is archived', c.name using errcode = '22023';
    end if;
    if c.kind::text <> p_type::text then
      raise exception 'category "%" is %, not %', c.name, c.kind, p_type using errcode = '22023';
    end if;
  end if;

  return a.currency;
end;
$$;

-- Write the two ledger entries implied by a transaction header.
create or replace function private.build_entries(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.transactions%rowtype;
begin
  select * into t from public.transactions where id = p_transaction_id;

  insert into public.ledger_entries (transaction_id, workspace_id, account_id, category_id, amount, currency)
  select t.id, t.workspace_id, x.account_id, x.category_id, x.amount, t.currency
    from (values
      -- (account_id, category_id, amount)
      (case when t.type = 'transfer' then t.counter_account_id
            when t.type = 'expense' then null
            else t.account_id end,
       case when t.type in ('transfer') then null
            when t.type = 'expense' then t.category_id
            else null end,
       t.amount),
      (case when t.type in ('transfer', 'expense') then t.account_id else null end,
       case when t.type in ('transfer', 'expense') then null else t.category_id end,
       -t.amount)
    ) as x (account_id, category_id, amount);
end;
$$;

create or replace function public.post_transaction(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p->>'workspace_id')::uuid;
  v_type public.transaction_type;
  v_currency char(3);
  v_id uuid;
begin
  perform private.require_workspace_owner(v_workspace_id);

  v_type := (p->>'type')::public.transaction_type;
  v_currency := private.validate_transaction(
    v_workspace_id, v_type,
    (p->>'account_id')::uuid, (p->>'counter_account_id')::uuid, (p->>'category_id')::uuid);

  if p ? 'currency' and p->>'currency' <> v_currency then
    raise exception 'currency % does not match the account currency %', p->>'currency', v_currency
      using errcode = '22023';
  end if;

  insert into public.transactions (
    workspace_id, type, occurred_at, currency, amount,
    account_id, counter_account_id, category_id,
    merchant, description, notes, source, created_by
  ) values (
    v_workspace_id, v_type,
    private.parse_occurred_at(p->>'occurred_at'),
    v_currency,
    private.parse_amount(p->'amount'),
    (p->>'account_id')::uuid, (p->>'counter_account_id')::uuid, (p->>'category_id')::uuid,
    nullif(btrim(p->>'merchant'), ''), nullif(btrim(p->>'description'), ''), nullif(btrim(p->>'notes'), ''),
    coalesce((p->>'source')::public.transaction_source, 'manual'),
    (select auth.uid())
  )
  returning id into v_id;

  perform private.build_entries(v_id);
  return v_id;
end;
$$;

-- Edit a posted transaction. Keys present in p replace the stored value (a JSON
-- null clears an optional text field); keys absent are kept. Entries are rebuilt.
-- opening_balance transactions accept amount, occurred_at, description and notes.
-- adjustment transactions are not editable: void and reconcile again.
create or replace function public.update_transaction(p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.transactions%rowtype;
  v_type public.transaction_type;
  v_account uuid;
  v_counter uuid;
  v_category uuid;
  v_currency char(3);
begin
  select * into t from public.transactions where id = p_id for update;
  if not found or not private.is_workspace_owner(t.workspace_id) then
    perform private.require_workspace_owner(null); -- raises 'not authenticated' / 'workspace not found'
  end if;

  if t.status = 'void' then
    raise exception 'a void transaction cannot be edited' using errcode = '22023';
  end if;
  if t.type = 'adjustment' then
    raise exception 'adjustments cannot be edited; void it and reconcile again' using errcode = '22023';
  end if;

  if t.type = 'opening_balance' then
    if p ?| array['type', 'account_id', 'counter_account_id', 'category_id', 'merchant', 'currency'] then
      raise exception 'an opening balance can only change amount, date, description and notes' using errcode = '22023';
    end if;
    v_type := t.type; v_account := t.account_id; v_counter := null; v_category := t.category_id;
    v_currency := t.currency;
  else
    v_type := coalesce((p->>'type')::public.transaction_type, t.type);
    v_account := case when p ? 'account_id' then (p->>'account_id')::uuid else t.account_id end;
    v_counter := case when p ? 'counter_account_id' then (p->>'counter_account_id')::uuid
                      when v_type = 'transfer' then t.counter_account_id else null end;
    v_category := case when p ? 'category_id' then (p->>'category_id')::uuid
                       when v_type = 'transfer' then null
                       when v_type = t.type then t.category_id else null end;
    v_currency := private.validate_transaction(
      t.workspace_id, v_type, v_account, v_counter, v_category,
      array_remove(array[t.account_id, t.counter_account_id, t.category_id], null));
    if v_currency <> t.currency and not p ? 'amount' then
      raise exception 'moving to a % account changes the currency from %; send the amount in % too',
        v_currency, t.currency, v_currency using errcode = '22023';
    end if;
    if p ? 'currency' and p->>'currency' <> v_currency then
      raise exception 'currency % does not match the account currency %', p->>'currency', v_currency
        using errcode = '22023';
    end if;
  end if;

  delete from public.ledger_entries where transaction_id = t.id;

  update public.transactions set
    type = v_type,
    account_id = v_account,
    counter_account_id = v_counter,
    category_id = v_category,
    currency = v_currency,
    amount = case when p ? 'amount'
                  then private.parse_amount(p->'amount', t.type = 'opening_balance')
                  else t.amount end,
    occurred_at = case when p ? 'occurred_at' then private.parse_occurred_at(p->>'occurred_at') else t.occurred_at end,
    merchant = case when p ? 'merchant' then nullif(btrim(p->>'merchant'), '') else t.merchant end,
    description = case when p ? 'description' then nullif(btrim(p->>'description'), '') else t.description end,
    notes = case when p ? 'notes' then nullif(btrim(p->>'notes'), '') else t.notes end
  where id = t.id;

  perform private.build_entries(t.id);
end;
$$;

create or replace function public.void_transaction(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.transactions%rowtype;
begin
  select * into t from public.transactions where id = p_id for update;
  if not found or not private.is_workspace_owner(t.workspace_id) then
    perform private.require_workspace_owner(null);
  end if;
  if t.status = 'void' then
    raise exception 'transaction is already void' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'a reason (1-500 characters) is required to void a transaction' using errcode = '22023';
  end if;

  -- Read by the audit trigger for this statement only.
  perform set_config('kara.audit_reason', btrim(p_reason), true);
  delete from public.ledger_entries where transaction_id = t.id;
  update public.transactions set status = 'void' where id = t.id;
  perform set_config('kara.audit_reason', '', true);
end;
$$;

create or replace function public.create_account(
  p_workspace_id uuid,
  p_name text,
  p_type public.account_type,
  p_currency char(3) default null,
  p_opening_balance bigint default 0,
  p_opening_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.workspaces%rowtype;
  v_account_id uuid;
  v_transaction_id uuid;
begin
  perform private.require_workspace_owner(p_workspace_id);
  select * into w from public.workspaces where id = p_workspace_id;

  if p_opening_balance is null or abs(p_opening_balance) > 1000000000000000 then
    raise exception 'opening balance is missing or too large' using errcode = '22023';
  end if;

  insert into public.accounts (workspace_id, name, type, currency, created_by)
  values (p_workspace_id, btrim(p_name), p_type, coalesce(p_currency, w.base_currency), (select auth.uid()))
  returning id into v_account_id;

  if p_opening_balance <> 0 then
    insert into public.transactions (
      workspace_id, type, occurred_at, currency, amount, account_id, category_id, description, created_by
    )
    select p_workspace_id, 'opening_balance',
           -- local midnight on the opening date, in the workspace timezone
           (coalesce(p_opening_date, (now() at time zone w.timezone)::date)::timestamp at time zone w.timezone),
           a.currency, p_opening_balance, a.id, c.id, 'Opening balance', (select auth.uid())
      from public.accounts a, public.categories c
     where a.id = v_account_id
       and c.workspace_id = p_workspace_id and c.system_key = 'opening_balance'
    returning id into v_transaction_id;

    perform private.build_entries(v_transaction_id);
  end if;

  return v_account_id;
end;
$$;

-- Compare the ledger balance with the real-world balance and post the
-- difference. Returns the adjustment id, or null when they already match.
create or replace function public.reconcile_account(
  p_account_id uuid,
  p_actual_balance bigint,
  p_as_of timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.accounts%rowtype;
  v_ledger_balance bigint;
  v_difference bigint;
  v_transaction_id uuid;
begin
  -- Lock the account so two concurrent reconciles cannot both post the same difference.
  select * into a from public.accounts where id = p_account_id for update;
  if not found or not private.is_workspace_owner(a.workspace_id) then
    perform private.require_workspace_owner(null);
  end if;
  if a.is_archived then
    raise exception 'account "%" is archived', a.name using errcode = '22023';
  end if;
  if p_actual_balance is null or abs(p_actual_balance) > 1000000000000000 then
    raise exception 'actual balance is missing or too large' using errcode = '22023';
  end if;
  if p_as_of is null then
    raise exception 'as_of is required' using errcode = '22023';
  end if;

  select coalesce(sum(e.amount), 0)::bigint into v_ledger_balance
    from public.ledger_entries e
    join public.transactions t on t.id = e.transaction_id
   where e.account_id = a.id and t.occurred_at <= p_as_of;

  v_difference := p_actual_balance - v_ledger_balance;
  if v_difference = 0 then
    return null;
  end if;
  if abs(v_difference) > 1000000000000000 then
    raise exception 'adjustment is too large' using errcode = '22023';
  end if;

  insert into public.transactions (
    workspace_id, type, occurred_at, currency, amount, account_id, category_id, description, created_by
  )
  select a.workspace_id, 'adjustment', p_as_of, a.currency, v_difference, a.id, c.id,
         'Balance adjustment', (select auth.uid())
    from public.categories c
   where c.workspace_id = a.workspace_id and c.system_key = 'balance_adjustment'
  returning id into v_transaction_id;

  perform private.build_entries(v_transaction_id);
  return v_transaction_id;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;

revoke execute on function
  public.post_transaction(jsonb),
  public.update_transaction(uuid, jsonb),
  public.void_transaction(uuid, text),
  public.create_account(uuid, text, public.account_type, char, bigint, date),
  public.reconcile_account(uuid, bigint, timestamptz)
from public, anon;

grant execute on function
  public.post_transaction(jsonb),
  public.update_transaction(uuid, jsonb),
  public.void_transaction(uuid, text),
  public.create_account(uuid, text, public.account_type, char, bigint, date),
  public.reconcile_account(uuid, bigint, timestamptz)
to authenticated;
