-- Task 7: aggregate functions match the ledger, exclude transfers, respect the
-- workspace timezone, and never sum across currencies.
begin;
select plan(16);

select tests.create_user('alice@test.local') as alice \gset
select tests.personal_ws(:'alice') as ws \gset
select tests.category(:'ws', 'Food') as food \gset
select tests.category(:'ws', 'Salary') as salary \gset

select tests.authenticate_as(:'alice');
select public.create_account(:'ws', 'Bank', 'bank', 'KRW', 1000000, '2026-10-01') as bank \gset
select public.create_account(:'ws', 'Cash', 'cash') as cash \gset
select public.create_account(:'ws', 'Dollars', 'bank', 'USD', 50000, '2026-10-01') as usd \gset

select public.post_transaction(jsonb_build_object('workspace_id', :'ws', 'type', 'income', 'account_id', :'bank',
  'category_id', :'salary', 'amount', 500000, 'occurred_at', '2026-10-15T09:00:00+09:00'));
-- 23:30 KST on 31 Oct: October locally, and also October in UTC (14:30Z)
select public.post_transaction(jsonb_build_object('workspace_id', :'ws', 'type', 'expense', 'account_id', :'bank',
  'category_id', :'food', 'amount', 10000, 'occurred_at', '2026-10-31T23:30:00+09:00'));
-- 00:30 KST on 1 Nov: November locally, but still 31 Oct in UTC (15:30Z)
select public.post_transaction(jsonb_build_object('workspace_id', :'ws', 'type', 'expense', 'account_id', :'bank',
  'category_id', :'food', 'amount', 20000, 'occurred_at', '2026-11-01T00:30:00+09:00'));
select public.post_transaction(jsonb_build_object('workspace_id', :'ws', 'type', 'transfer', 'account_id', :'bank',
  'counter_account_id', :'cash', 'amount', 300000, 'occurred_at', '2026-10-20T12:00:00+09:00'));
select public.post_transaction(jsonb_build_object('workspace_id', :'ws', 'type', 'expense', 'account_id', :'usd',
  'category_id', :'food', 'amount', 1500, 'occurred_at', '2026-10-10T12:00:00+09:00'));

-- period_totals
select results_eq(
  format($$ select currency::text, income, expense, net from public.period_totals(%L, '2026-10-01', '2026-10-31') order by currency $$, :'ws'),
  $$ values ('KRW', 500000::bigint, 10000::bigint, 490000::bigint), ('USD', 0::bigint, 1500::bigint, -1500::bigint) $$,
  'October totals: per currency, opening balances and transfers excluded (FIN-2, FIN-4)');
select results_eq(
  format($$ select currency::text, income, expense from public.period_totals(%L, '2026-11-01', '2026-11-30') $$, :'ws'),
  $$ values ('KRW', 0::bigint, 20000::bigint) $$,
  '00:30 KST on 1 Nov counts in November in the workspace timezone (FIN-7)');
select is_empty(format($$ select * from public.period_totals(%L, '2026-12-01', '2026-12-31') $$, :'ws'),
  'a period with no activity returns no rows');
select throws_like(format($$ select * from public.period_totals(%L, '2026-10-31', '2026-10-01') $$, :'ws'),
  '%from_date%', 'a reversed date range is rejected');

-- category_totals
select results_eq(
  format($$ select name, kind::text, currency::text, total from public.category_totals(%L, '2026-10-01', '2026-10-31') order by currency, kind, name $$, :'ws'),
  $$ values ('Food', 'expense', 'KRW', 10000::bigint), ('Salary', 'income', 'KRW', 500000::bigint), ('Food', 'expense', 'USD', 1500::bigint) $$,
  'category totals for October, transfers excluded');

-- account_balances
select is((select balance from public.account_balances(:'ws') where account_id = :'bank'), 1170000::bigint,
  'bank balance: 1,000,000 + 500,000 - 10,000 - 20,000 - 300,000');
select is((select balance from public.account_balances(:'ws') where account_id = :'cash'), 300000::bigint,
  'cash balance includes the transfer');
select is((select balance from public.account_balances(:'ws') where account_id = :'usd'), 48500::bigint,
  'USD balance is kept in its own currency');
select is((select balance from public.account_balances(:'ws', '2026-10-31T23:59:59+09:00') where account_id = :'bank'), 1190000::bigint,
  'balance as of the end of October excludes November activity');
select is((select balance from public.account_balances(:'ws', '2026-09-30T23:59:59+09:00') where account_id = :'bank'), 0::bigint,
  'balance before the opening date is zero');

-- FIN-8: aggregates agree with the raw ledger
select is(
  (select sum(balance)::bigint from public.account_balances(:'ws') where currency = 'KRW'),
  (select sum(e.amount)::bigint from public.ledger_entries e join public.accounts a on a.id = e.account_id
    where a.workspace_id = :'ws' and a.currency = 'KRW'),
  'sum of KRW balances equals the sum of KRW account-side ledger entries (FIN-8)');
select is(
  (select sum(net)::bigint from public.period_totals(:'ws', '2026-10-01', '2026-11-30') where currency = 'KRW'),
  (select sum(total) filter (where kind = 'income')::bigint - sum(total) filter (where kind = 'expense')::bigint
     from public.category_totals(:'ws', '2026-10-01', '2026-11-30') where currency = 'KRW'),
  'period net equals income minus expense from category totals');
select is_empty(format($$ select * from public.ledger_integrity_check(%L) $$, :'ws'),
  'ledger integrity check finds no unbalanced transactions');
select is((select balance from public.account_balances(:'ws', null) where account_id = :'bank'), 1170000::bigint,
  'a null as_of means now, not zero (review fix)');

-- Deleting a user removes their whole ledger cleanly (review fix)
select tests.clear_authentication();
select lives_ok(format($$ delete from auth.users where id = %L $$, :'alice'), 'a user with transactions can be deleted');
select lives_ok($$ select tests.flush_constraints() $$, 'deletion leaves no dangling ledger rows');

select * from finish();
rollback;
