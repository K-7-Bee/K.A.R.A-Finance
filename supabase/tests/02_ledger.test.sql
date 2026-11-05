-- Task 3: database-level ledger enforcement. Runs as postgres and writes raw rows,
-- bypassing the posting service, to prove the DB itself rejects bad ledgers.
begin;
select plan(16);

select tests.create_user('alice@test.local') as alice \gset
select tests.personal_ws(:'alice') as ws \gset
select tests.category(:'ws', 'Food') as food \gset
select tests.category(:'ws', 'Salary') as salary \gset

insert into public.accounts (workspace_id, name, type, currency)
values (:'ws', 'Bank', 'bank', 'KRW'), (:'ws', 'Cash', 'cash', 'KRW'), (:'ws', 'Dollars', 'bank', 'USD');
select id as bank from public.accounts where workspace_id = :'ws' and name = 'Bank' \gset
select id as cash from public.accounts where workspace_id = :'ws' and name = 'Cash' \gset
select id as usd from public.accounts where workspace_id = :'ws' and name = 'Dollars' \gset

-- Valid shapes
select lives_ok(format($$ select tests.raw_txn(%L, 'expense', %L, null, %L, 5000,
  '[{"category_id": %s, "amount": 5000}, {"account_id": %s, "amount": -5000}]') $$,
  :'ws', :'bank', :'food', to_json(:'food'::text), to_json(:'bank'::text)),
  'a balanced expense is accepted');

select lives_ok(format($$ select tests.raw_txn(%L, 'income', %L, null, %L, 9000,
  '[{"account_id": %s, "amount": 9000}, {"category_id": %s, "amount": -9000}]') $$,
  :'ws', :'bank', :'salary', to_json(:'bank'::text), to_json(:'salary'::text)),
  'a balanced income is accepted');

select lives_ok(format($$ select tests.raw_txn(%L, 'transfer', %L, %L, null, 2000,
  '[{"account_id": %s, "amount": 2000}, {"account_id": %s, "amount": -2000}]') $$,
  :'ws', :'bank', :'cash', to_json(:'cash'::text), to_json(:'bank'::text)),
  'a transfer between two own accounts is accepted');

-- FIN-1: unbalanced and malformed
select throws_like(format($$ select tests.raw_txn(%L, 'expense', %L, null, %L, 5000,
  '[{"category_id": %s, "amount": 5000}, {"account_id": %s, "amount": -4000}]') $$,
  :'ws', :'bank', :'food', to_json(:'food'::text), to_json(:'bank'::text)),
  '%unbalanced%', 'an unbalanced transaction is rejected (FIN-1)');

select throws_like(format($$ select tests.raw_txn(%L, 'expense', %L, null, %L, 5000,
  '[{"category_id": %s, "amount": 5000}]') $$,
  :'ws', :'bank', :'food', to_json(:'food'::text)),
  '%entries%', 'a single-entry transaction is rejected (FIN-1)');

select throws_like(format($$ select tests.raw_txn(%L, 'expense', %L, null, %L, 5000,
  '[{"category_id": %s, "amount": 7000}, {"account_id": %s, "amount": -7000}]') $$,
  :'ws', :'bank', :'food', to_json(:'food'::text), to_json(:'bank'::text)),
  '%do not match%', 'entries that disagree with the transaction header are rejected');

select throws_like(format($$ select tests.raw_txn(%L, 'expense', %L, null, %L, 5000,
  '[{"category_id": %s, "amount": 5000}, {"account_id": %s, "amount": -5000}]') $$,
  :'ws', :'bank', :'salary', to_json(:'salary'::text), to_json(:'bank'::text)),
  '%category%', 'an expense posted to an income category is rejected');

select throws_ok(format($$ insert into public.ledger_entries (transaction_id, workspace_id, account_id, category_id, amount, currency)
  select id, workspace_id, %L, %L, 1, 'KRW' from public.transactions limit 1 $$, :'bank', :'food'),
  '23514', null, 'an entry cannot reference both an account and a category');

-- FIN-2: transfers can never touch income or expense
select throws_ok(format($$ select tests.raw_txn(%L, 'transfer', %L, %L, %L, 2000,
  '[{"account_id": %s, "amount": 2000}, {"account_id": %s, "amount": -2000}]') $$,
  :'ws', :'bank', :'cash', :'food', to_json(:'cash'::text), to_json(:'bank'::text)),
  '23514', null, 'a transfer cannot carry a category (FIN-2)');

select throws_like(format($$ select tests.raw_txn(%L, 'transfer', %L, %L, null, 2000,
  '[{"category_id": %s, "amount": 2000}, {"account_id": %s, "amount": -2000}]') $$,
  :'ws', :'bank', :'cash', to_json(:'food'::text), to_json(:'bank'::text)),
  '%do not match%', 'a transfer with a category ledger entry is rejected (FIN-2)');

select throws_ok(format($$ select tests.raw_txn(%L, 'transfer', %L, %L, null, 2000,
  '[{"account_id": %s, "amount": 2000}, {"account_id": %s, "amount": -2000}]') $$,
  :'ws', :'bank', :'bank', to_json(:'bank'::text), to_json(:'bank'::text)),
  '23514', null, 'a transfer to the same account is rejected');

-- FIN-4: currency consistency
select throws_ok(format($$ select tests.raw_txn(%L, 'expense', %L, null, %L, 5000,
  '[{"category_id": %s, "amount": 5000}, {"account_id": %s, "amount": -5000, "currency": "USD"}]') $$,
  :'ws', :'bank', :'food', to_json(:'food'::text), to_json(:'bank'::text)),
  null, null, 'an entry in a different currency from its account is rejected (FIN-4)');

select throws_ok(format($$ select tests.raw_txn(%L, 'transfer', %L, %L, null, 2000,
  '[{"account_id": %s, "amount": 2000}, {"account_id": %s, "amount": -2000}]') $$,
  :'ws', :'bank', :'usd', to_json(:'usd'::text), to_json(:'bank'::text)),
  '23503', null, 'a cross-currency transfer is rejected (Stage 1)');

-- Void transactions carry no ledger entries
select throws_like(format($$ select tests.raw_txn(%L, 'expense', %L, null, %L, 5000,
  '[{"category_id": %s, "amount": 5000}, {"account_id": %s, "amount": -5000}]', 'KRW', 'void') $$,
  :'ws', :'bank', :'food', to_json(:'food'::text), to_json(:'bank'::text)),
  '%void%', 'a void transaction cannot have ledger entries');

-- FIN-5: failed attempts left nothing behind
select is((select count(*)::int from public.transactions where workspace_id = :'ws'), 3,
  'only the three valid transactions persisted (FIN-5)');
select is((select count(*)::int from public.ledger_entries where workspace_id = :'ws'), 6,
  'only their six ledger entries persisted (FIN-5)');

select * from finish();
rollback;
