-- Phase 1a / Task 7: aggregate functions (GOV-3).
--
-- The dashboard reads totals only through these, and the future AI assistant
-- will use the same functions as read-only tools, so every number shown to a
-- user comes from one place. They are SECURITY INVOKER: RLS still applies, so a
-- caller only ever aggregates rows they can read.
--
-- Rules:
--   * Results are per currency. Amounts in different currencies are never added.
--   * Income/expense come only from income/expense category entries, so
--     transfers, opening balances and adjustments are excluded by construction.
--   * Date ranges are inclusive local dates in the workspace's timezone.

-- [from_date, to_date] in the workspace timezone -> [lo, hi) instants.
create or replace function private.local_date_range(p_workspace_id uuid, p_from date, p_to date)
returns table (lo timestamptz, hi timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'from_date must be on or before to_date' using errcode = '22023';
  end if;
  select timezone into v_tz from public.workspaces
   where id = p_workspace_id and private.is_workspace_owner(id);
  -- Unknown or someone else's workspace: no range, so callers get no rows.
  if v_tz is null then
    return;
  end if;
  lo := p_from::timestamp at time zone v_tz;
  hi := (p_to + 1)::timestamp at time zone v_tz;
  return next;
end;
$$;

create or replace function public.account_balances(
  p_workspace_id uuid,
  p_as_of timestamptz default now()
)
returns table (
  account_id uuid,
  name text,
  type public.account_type,
  currency char(3),
  is_archived boolean,
  balance bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.name, a.type, a.currency, a.is_archived,
         coalesce(sum(e.amount) filter (where t.occurred_at <= coalesce(p_as_of, now())), 0)::bigint
    from public.accounts a
    left join public.ledger_entries e on e.account_id = a.id
    left join public.transactions t on t.id = e.transaction_id
   where a.workspace_id = p_workspace_id
   group by a.id
   order by a.name;
$$;

create or replace function public.period_totals(
  p_workspace_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (currency char(3), income bigint, expense bigint, net bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with totals as (
    select e.currency,
           coalesce(-sum(e.amount) filter (where c.kind = 'income'), 0)::bigint as income,
           coalesce(sum(e.amount) filter (where c.kind = 'expense'), 0)::bigint as expense
      from private.local_date_range(p_workspace_id, p_from_date, p_to_date) r
      join public.transactions t
        on t.workspace_id = p_workspace_id and t.occurred_at >= r.lo and t.occurred_at < r.hi
      join public.ledger_entries e on e.transaction_id = t.id
      join public.categories c on c.id = e.category_id
     where c.kind in ('income', 'expense')
     group by e.currency
  )
  select currency, income, expense, income - expense from totals order by currency;
$$;

create or replace function public.category_totals(
  p_workspace_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (category_id uuid, name text, kind public.category_kind, currency char(3), total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.name, c.kind, e.currency,
         (case when c.kind = 'income' then -sum(e.amount) else sum(e.amount) end)::bigint
    from private.local_date_range(p_workspace_id, p_from_date, p_to_date) r
    join public.transactions t
      on t.workspace_id = p_workspace_id and t.occurred_at >= r.lo and t.occurred_at < r.hi
    join public.ledger_entries e on e.transaction_id = t.id
    join public.categories c on c.id = e.category_id
   where c.kind in ('income', 'expense')
   group by c.id, e.currency
   order by e.currency, c.kind, c.name;
$$;

-- Posted transactions whose ledger is wrong. Should always return no rows;
-- the deferred constraint trigger makes this a second, independent check.
create or replace function public.ledger_integrity_check(p_workspace_id uuid)
returns table (transaction_id uuid, entry_count int, entry_sum bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, count(e.id)::int, coalesce(sum(e.amount), 0)::bigint
    from public.transactions t
    left join public.ledger_entries e on e.transaction_id = t.id
   where t.workspace_id = p_workspace_id and t.status = 'posted'
   group by t.id
  having count(e.id) <> 2 or coalesce(sum(e.amount), 0) <> 0;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
-- Re-grant what RLS policies and the invoker aggregates need.
grant execute on function private.is_workspace_owner(uuid) to authenticated;
grant execute on function private.local_date_range(uuid, date, date) to authenticated;

revoke execute on function
  public.account_balances(uuid, timestamptz),
  public.period_totals(uuid, date, date),
  public.category_totals(uuid, date, date),
  public.ledger_integrity_check(uuid)
from public, anon;

grant execute on function
  public.account_balances(uuid, timestamptz),
  public.period_totals(uuid, date, date),
  public.category_totals(uuid, date, date),
  public.ledger_integrity_check(uuid)
to authenticated;
