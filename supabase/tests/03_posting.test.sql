-- Task 4: the posting service is the single write path, validates input,
-- produces balanced postings atomically, and is scoped to the caller.
begin;
select plan(43);

select tests.create_user('alice@test.local') as alice \gset
select tests.create_user('bob@test.local') as bob \gset
select tests.personal_ws(:'alice') as ws \gset
select tests.personal_ws(:'bob') as bob_ws \gset
select tests.category(:'ws', 'Food') as food \gset
select tests.category(:'ws', 'Salary') as salary \gset
select tests.category(:'bob_ws', 'Food') as bob_food \gset

select tests.authenticate_as(:'alice');

-- create_account + opening balances (DOD-ACC)
select public.create_account(:'ws', 'Bank', 'bank', 'KRW', 1000000, '2026-01-01') as bank \gset
select public.create_account(:'ws', 'Card', 'credit_card', null, -200000, '2026-01-01') as card \gset
select public.create_account(:'ws', 'Cash', 'cash') as cash \gset

select is(tests.balance(:'bank'), 1000000::bigint, 'opening balance sets the account balance');
select is(tests.balance(:'card'), -200000::bigint, 'a credit card can open with a negative balance');
select is((select currency::text from public.accounts where id = :'card'), 'KRW',
  'account currency defaults to the workspace base currency');
select is((select count(*)::int from public.transactions where account_id = :'cash'), 0,
  'a zero opening balance posts nothing');
select is(
  (select c.system_key from public.transactions t join public.categories c on c.id = t.category_id
    where t.account_id = :'bank' and t.type = 'opening_balance'),
  'opening_balance', 'opening balance is backed by the system equity category');
select is((select occurred_at from public.transactions where account_id = :'bank' and type = 'opening_balance'),
  '2026-01-01 00:00:00+09'::timestamptz, 'opening balance is dated at local midnight in the workspace timezone');

-- post_transaction
select public.post_transaction(jsonb_build_object(
  'workspace_id', :'ws', 'type', 'expense', 'account_id', :'bank', 'category_id', :'food',
  'amount', 50000, 'occurred_at', '2026-11-03T12:00:00+09:00', 'merchant', 'Mart')) as exp \gset
select public.post_transaction(jsonb_build_object(
  'workspace_id', :'ws', 'type', 'income', 'account_id', :'bank', 'category_id', :'salary',
  'amount', 3000000, 'occurred_at', '2026-11-01T09:00:00+09:00')) as inc \gset

select is(tests.balance(:'bank'), 3950000::bigint, 'income and expense move the account balance');
select is((select source::text from public.transactions where id = :'exp'), 'manual', 'source defaults to manual (GOV-2)');
select is((select created_by from public.transactions where id = :'exp'), :'alice'::uuid, 'created_by is the caller (GOV-2)');

-- Transfers (FIN-2)
select coalesce(array_agg(t order by t.currency)::text, '{}') as before_totals
  from public.period_totals(:'ws', '2026-11-01', '2026-11-30') t \gset
select public.post_transaction(jsonb_build_object(
  'workspace_id', :'ws', 'type', 'transfer', 'account_id', :'bank', 'counter_account_id', :'cash',
  'amount', 100000, 'occurred_at', '2026-11-04T10:00:00+09:00')) as xfer \gset

select is(tests.balance(:'bank'), 3850000::bigint, 'a transfer reduces the source account');
select is(tests.balance(:'cash'), 100000::bigint, 'a transfer increases the destination account');
select is((select coalesce(array_agg(t order by t.currency)::text, '{}') from public.period_totals(:'ws', '2026-11-01', '2026-11-30') t), :'before_totals',
  'a transfer does not change income or expense totals (FIN-2)');

-- update_transaction
select lives_ok(format($$ select public.update_transaction(%L, '{"amount": 70000, "notes": "corrected"}') $$, :'exp'),
  'an expense can be edited');
select is(tests.balance(:'bank'), 3830000::bigint, 'editing the amount rebuilds the ledger');
select is((select count(*)::int from public.ledger_entries where transaction_id = :'exp'), 2,
  'an edited transaction still has exactly two entries');
select is((select merchant from public.transactions where id = :'exp'), 'Mart',
  'fields not in the edit are kept');

-- void_transaction
select lives_ok(format($$ select public.void_transaction(%L, 'entered twice') $$, :'inc'), 'income can be voided');
select is(tests.balance(:'bank'), 830000::bigint, 'voiding removes the transaction from balances');
select is((select status::text from public.transactions where id = :'inc'), 'void', 'the transaction stays as void, not deleted');
select throws_like(format($$ select public.update_transaction(%L, '{"amount": 1}') $$, :'inc'),
  '%void%', 'a void transaction cannot be edited');
select throws_like(format($$ select public.void_transaction(%L, '') $$, :'exp'),
  '%reason%', 'voiding requires a reason');

-- reconcile_account (DOD-ACC)
select public.reconcile_account(:'bank', 800000) as adj \gset
select is(tests.balance(:'bank'), 800000::bigint, 'reconciliation brings the balance to the actual amount');
select is((select amount from public.transactions where id = :'adj'), -30000::bigint,
  'the adjustment is the exact difference');
select is(public.reconcile_account(:'bank', 800000), null, 'reconciling a matching balance posts nothing');

-- Input validation
select throws_like(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": 0, "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'ws', :'bank', :'food'),
  '%amount%', 'zero amounts are rejected');
select throws_like(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": 12.5, "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'ws', :'bank', :'food'),
  '%amount%', 'fractional minor units are rejected (FIN-3)');
select throws_like(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": "500", "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'ws', :'bank', :'food'),
  '%amount%', 'string amounts are rejected');
select throws_like(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": 500, "occurred_at": "2026-11-03T12:00:00"}') $$, :'ws', :'bank', :'food'),
  '%offset%', 'timestamps without a UTC offset are rejected (FIN-7)');
select throws_like(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": 500, "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'ws', :'bank', :'salary'),
  '%category%', 'an expense cannot use an income category');
select throws_like(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "opening_balance", "account_id": "%s", "amount": 500, "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'ws', :'bank'),
  '%type%', 'opening balances cannot be posted through post_transaction');

update public.accounts set is_archived = true where id = :'card';
select throws_like(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": 500, "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'ws', :'card', :'food'),
  '%archived%', 'archived accounts cannot receive new transactions');

-- Records in an archived category stay editable (review fix)
update public.categories set is_archived = true where id = :'food';
select lives_ok(format($$ select public.update_transaction(%L, '{"notes": "still editable"}') $$, :'exp'),
  'a transaction in an archived category can still be edited');

-- Moving to an account in another currency needs an explicit new amount (review fix)
select public.create_account(:'ws', 'Dollars', 'bank', 'USD') as usd \gset
select throws_like(format($$ select public.update_transaction(%L, '{"account_id": "%s"}') $$, :'exp', :'usd'),
  '%currency%', 'changing to an account in another currency without a new amount is rejected');

select throws_like(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "income", "account_id": "%s", "category_id": "%s", "amount": 500, "occurred_at": "2026-11-01 PST+00"}') $$, :'ws', :'bank', :'salary'),
  '%offset%', 'non-ISO timestamps are rejected');

-- Atomicity (FIN-5): a failed create_account leaves no account behind
select throws_ok(format($$ select public.create_account(%L, 'Ghost', 'bank', 'XXX', 1000) $$, :'ws'));
select is((select count(*)::int from public.accounts where name = 'Ghost'), 0, 'a failed create_account writes nothing (FIN-5)');

-- Every posting so far is valid at commit time
select lives_ok($$ select tests.flush_constraints() $$, 'all postings pass deferred ledger checks');

-- SEC-1: another user cannot use the posting service on Alice's data
select tests.authenticate_as(:'bob');
select throws_ok(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": 500, "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'ws', :'bank', :'food'),
  '42501', null, 'Bob cannot post into Alice''s workspace');
select throws_ok(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": 500, "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'bob_ws', :'bank', :'bob_food'),
  null, null, 'Bob cannot post against Alice''s account from his own workspace');
select throws_ok(format($$ select public.update_transaction(%L, '{"amount": 1}') $$, :'exp'),
  '42501', null, 'Bob cannot edit Alice''s transaction');
select throws_ok(format($$ select public.void_transaction(%L, 'nope') $$, :'exp'),
  '42501', null, 'Bob cannot void Alice''s transaction');
select throws_ok(format($$ select public.reconcile_account(%L, 0) $$, :'bank'),
  '42501', null, 'Bob cannot reconcile Alice''s account');

select tests.authenticate_as_anon();
select throws_ok(format($$ select public.create_account(%L, 'X', 'cash') $$, :'ws'),
  '42501', null, 'anonymous callers cannot use the posting service');

select * from finish();
rollback;
