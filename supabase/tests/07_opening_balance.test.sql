-- Phase 1c / Task 1: set_opening_balance adds, changes or removes an
-- account's opening balance after creation.
begin;
select plan(17);

select tests.create_user('alice@test.local') as alice \gset
select tests.create_user('bob@test.local') as bob \gset
select tests.personal_ws(:'alice') as ws \gset

select tests.authenticate_as(:'alice');
select public.create_account(:'ws', 'Wallet', 'cash') as wallet \gset
select public.create_account(:'ws', 'Bank', 'bank', 'KRW', 1000000, '2026-01-01') as bank \gset

-- Add to an account created with 0
select public.set_opening_balance(:'wallet', 50000, '2026-02-01') as wallet_open \gset
select is(tests.balance(:'wallet'), 50000::bigint, 'adding an opening balance sets the balance');
select is((select count(*)::int from public.transactions where account_id = :'wallet' and type = 'opening_balance' and status = 'posted'), 1,
  'exactly one posted opening balance');
select is((select occurred_at from public.transactions where id = :'wallet_open'), '2026-02-01 00:00:00+09'::timestamptz,
  'dated at local midnight in the workspace timezone');

-- Change an existing one: same transaction, new amount
select public.set_opening_balance(:'bank', 1200000) as bank_open \gset
select is(tests.balance(:'bank'), 1200000::bigint, 'changing the opening balance moves the balance by the difference');
select is((select count(*)::int from public.transactions where account_id = :'bank' and type = 'opening_balance'), 1,
  'changing updates the existing transaction rather than adding one');
select is((select occurred_at from public.transactions where id = :'bank_open'), '2026-01-01 00:00:00+09'::timestamptz,
  'the date is kept when none is given');
select is(
  (select array[before->>'amount', after->>'amount'] from public.audit_log
    where table_name = 'transactions' and row_id = :'bank_open' and action = 'update'),
  array['1000000', '1200000'], 'the change is audited with before and after amounts');

-- Negative (an overdraft or a card balance owed)
select lives_ok(format($$ select public.set_opening_balance(%L, -30000) $$, :'wallet'), 'a negative opening balance is allowed');
select is(tests.balance(:'wallet'), -30000::bigint, 'negative opening balance applied');

-- Remove: 0 voids it
select is(public.set_opening_balance(:'wallet', 0), null, 'setting 0 returns null');
select is(tests.balance(:'wallet'), 0::bigint, 'removing the opening balance drops it from the balance');
select is((select status::text from public.transactions where id = :'wallet_open'), 'void', 'the opening balance is voided, not deleted');
select is(public.set_opening_balance(:'wallet', 0), null, 'removing when there is none is a no-op');

-- Guards
update public.accounts set is_archived = true where id = :'wallet';
select throws_like(format($$ select public.set_opening_balance(%L, 100) $$, :'wallet'), '%archived%',
  'archived accounts are rejected');
select throws_like(format($$ select public.set_opening_balance(%L, 2000000000000000) $$, :'bank'), '%too large%',
  'absurd amounts are rejected');

select lives_ok($$ select tests.flush_constraints() $$, 'all postings pass deferred ledger checks');

select tests.authenticate_as(:'bob');
select throws_ok(format($$ select public.set_opening_balance(%L, 1) $$, :'bank'), '42501', null,
  'another user cannot set your opening balance');

select * from finish();
rollback;
