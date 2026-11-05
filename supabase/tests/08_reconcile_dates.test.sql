-- Phase 1c review fixes: reconcile by local date (computed in SQL), date guards,
-- and set_opening_balance coverage gaps.
begin;
select plan(17);

select tests.create_user('alice@test.local') as alice \gset
select tests.personal_ws(:'alice') as ws \gset
select tests.category(:'ws', 'Food') as food \gset

select tests.authenticate_as(:'alice');
select public.create_account(:'ws', 'Bank', 'bank', 'KRW', 1000000, '2026-01-01') as bank \gset
select public.post_transaction(jsonb_build_object('workspace_id', :'ws', 'type', 'expense', 'account_id', :'bank',
  'category_id', :'food', 'amount', 10000, 'occurred_at', '2026-01-31T23:30:00+09:00'));
select public.post_transaction(jsonb_build_object('workspace_id', :'ws', 'type', 'expense', 'account_id', :'bank',
  'category_id', :'food', 'amount', 20000, 'occurred_at', '2026-02-01T00:30:00+09:00'));

-- Month-end: "as of Jan 31" includes 23:30 KST on Jan 31, excludes 00:30 on Feb 1,
-- and the adjustment is dated within Jan 31 (so it counts in current balances).
select public.reconcile_account_on_date(:'bank', 985000, '2026-01-31') as adj \gset
select is((select amount from public.transactions where id = :'adj'), -5000::bigint,
  'as of Jan 31: ledger 990,000, actual 985,000 -> -5,000');
select is((select occurred_at from public.transactions where id = :'adj'), '2026-01-31 23:59:59.999999+09'::timestamptz,
  'the adjustment is dated at the last instant of Jan 31 in the workspace timezone');
select is(tests.balance(:'bank'), 965000::bigint, 'the adjustment counts in the current balance');
select is((select balance from public.account_balances(:'ws') where account_id = :'bank'), 965000::bigint,
  'account_balances (as of now) includes it immediately');

-- Today: as of now
select public.reconcile_account_on_date(:'bank', 900000, (now() at time zone 'Asia/Seoul')::date) as adj_today \gset
select ok((select occurred_at <= now() from public.transactions where id = :'adj_today'), 'reconciling today is dated now, not in the future');
select is((select balance from public.account_balances(:'ws') where account_id = :'bank'), 900000::bigint, 'and shows at once');

-- Guards
select throws_like(format($$ select public.reconcile_account_on_date(%L, 1, (now() at time zone 'Asia/Seoul')::date + 1) $$, :'bank'),
  '%future%', 'reconcile dates in the future are rejected');
select throws_like(format($$ select public.reconcile_account_on_date(%L, 1, '2025-12-31') $$, :'bank'),
  '%before the opening date%', 'reconcile dates before the opening balance are rejected');
select throws_like(format($$ select public.set_opening_balance(%L, 1, (now() at time zone 'Asia/Seoul')::date + 1) $$, :'bank'),
  '%future%', 'future opening dates are rejected by set_opening_balance');
select throws_like(format($$ select public.create_account(%L, 'Later', 'cash', null, 100, (now() at time zone 'Asia/Seoul')::date + 1) $$, :'ws'),
  '%future%', 'future opening dates are rejected by create_account');

-- set_opening_balance coverage gaps
select public.create_account(:'ws', 'Wallet', 'cash', null, 5000, '2026-01-01') as wallet \gset
select public.set_opening_balance(:'wallet', 0);
select is((select reason from public.audit_log where table_name = 'transactions' and action = 'void'
            and (before->>'account_id')::uuid = :'wallet'), 'Opening balance removed', 'removal is audited with its reason');
select public.set_opening_balance(:'wallet', 7000, '2026-01-01');
select is((select count(*)::int from public.transactions where account_id = :'wallet' and type = 'opening_balance' and status = 'posted'), 1,
  're-adding after removal leaves exactly one posted opening balance');
select is(tests.balance(:'wallet'), 7000::bigint, 're-added opening balance applies');
select is_empty(format($$ select * from public.ledger_integrity_check(%L) $$, :'ws'), 'ledger integrity check is empty');

select tests.authenticate_as_anon();
select throws_ok(format($$ select public.set_opening_balance(%L, 1) $$, :'wallet'), '42501', null, 'anon cannot set opening balances');
select throws_ok(format($$ select public.reconcile_account_on_date(%L, 1, '2026-02-01') $$, :'wallet'), '42501', null, 'anon cannot reconcile');
reset role;

select lives_ok($$ select tests.flush_constraints() $$, 'all postings pass deferred ledger checks');

select * from finish();
rollback;
