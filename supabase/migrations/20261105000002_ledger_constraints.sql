-- Phase 1a / Task 3: ledger balance enforcement.
--
-- A deferred constraint trigger re-validates every touched transaction at
-- COMMIT, whatever code path wrote it. A posted transaction must:
--   * have exactly two ledger entries that sum to zero (FIN-1)
--   * use the transaction currency on every entry (FIN-4)
--   * have entries that match the shape its type and header demand, which keeps
--     transfers out of income and expense by construction (FIN-2)
-- A void transaction must have no entries.

create or replace function private.assert_transaction_valid(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.transactions%rowtype;
  v_count int;
  v_sum numeric;
  v_category_kind public.category_kind;
  v_category_system_key text;
  v_matches int;
begin
  select * into t from public.transactions where id = p_transaction_id;
  if not found then
    return; -- deleted along with its entries (e.g. workspace removal)
  end if;

  select count(*), coalesce(sum(amount), 0)
    into v_count, v_sum
    from public.ledger_entries
   where transaction_id = t.id;

  if t.status = 'void' then
    if v_count > 0 then
      raise exception 'void transaction % must not have ledger entries', t.id
        using errcode = '23514';
    end if;
    return;
  end if;

  if v_count <> 2 then
    raise exception 'transaction % must have exactly 2 ledger entries, found %', t.id, v_count
      using errcode = '23514';
  end if;

  if v_sum <> 0 then
    raise exception 'transaction % is unbalanced: entries sum to %', t.id, v_sum
      using errcode = '23514';
  end if;

  if exists (select 1 from public.ledger_entries
              where transaction_id = t.id and currency <> t.currency) then
    raise exception 'transaction % has entries in a currency other than %', t.id, t.currency
      using errcode = '23514';
  end if;

  if t.category_id is not null then
    select kind, system_key into v_category_kind, v_category_system_key
      from public.categories where id = t.category_id;

    if (t.type = 'income' and v_category_kind <> 'income')
       or (t.type = 'expense' and v_category_kind <> 'expense')
       or (t.type = 'opening_balance' and v_category_system_key is distinct from 'opening_balance')
       or (t.type = 'adjustment' and v_category_system_key is distinct from 'balance_adjustment') then
      raise exception 'category kind % does not fit a % transaction', v_category_kind, t.type
        using errcode = '23514';
    end if;
  elsif t.type <> 'transfer' then
    raise exception 'a % transaction needs a category', t.type using errcode = '23514';
  end if;

  -- Count entries matching the exact expected shape; both must match.
  select count(*) into v_matches
    from public.ledger_entries e
   where e.transaction_id = t.id
     and case t.type
       when 'income' then
            (e.account_id = t.account_id and e.amount = t.amount)
         or (e.category_id = t.category_id and e.amount = -t.amount)
       when 'expense' then
            (e.category_id = t.category_id and e.amount = t.amount)
         or (e.account_id = t.account_id and e.amount = -t.amount)
       when 'transfer' then
            (e.account_id = t.counter_account_id and e.amount = t.amount)
         or (e.account_id = t.account_id and e.amount = -t.amount)
       else -- opening_balance, adjustment: amount is the signed effect on the account
            (e.account_id = t.account_id and e.amount = t.amount)
         or (e.category_id = t.category_id and e.amount = -t.amount)
     end;

  if v_matches <> 2 then
    raise exception 'ledger entries do not match % transaction %', t.type, t.id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.check_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'transactions' then
    perform private.assert_transaction_valid(new.id);
  elsif tg_op = 'DELETE' then
    perform private.assert_transaction_valid(old.transaction_id);
  else
    perform private.assert_transaction_valid(new.transaction_id);
    if tg_op = 'UPDATE' and old.transaction_id <> new.transaction_id then
      perform private.assert_transaction_valid(old.transaction_id);
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger transactions_ledger_check
  after insert or update on public.transactions
  deferrable initially deferred
  for each row execute function private.check_ledger_trigger();

create constraint trigger ledger_entries_ledger_check
  after insert or update or delete on public.ledger_entries
  deferrable initially deferred
  for each row execute function private.check_ledger_trigger();

revoke all on all functions in schema private from public, anon, authenticated;
