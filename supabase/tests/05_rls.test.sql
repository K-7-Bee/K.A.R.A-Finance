-- Task 6: row-level security, least-privilege grants, workspace separation.
begin;
select plan(31);

select tests.create_user('alice@test.local') as alice \gset
select tests.create_user('bob@test.local') as bob \gset
select tests.personal_ws(:'alice') as ws \gset
select tests.category(:'ws', 'Food') as food \gset
select id as opening_cat from public.categories where workspace_id = :'ws' and system_key = 'opening_balance' \gset

-- Alice also owns a business workspace (fixture inserted as postgres)
insert into public.workspaces (owner_id, kind, name) values (:'alice', 'business', 'Alice Co') returning id as biz \gset
select private.seed_default_categories(:'biz');
select tests.category(:'biz', 'Food') as biz_food \gset

select tests.authenticate_as(:'alice');
select public.create_account(:'ws', 'Bank', 'bank', 'KRW', 100000, '2026-01-01') as bank \gset
select public.post_transaction(jsonb_build_object(
  'workspace_id', :'ws', 'type', 'expense', 'account_id', :'bank', 'category_id', :'food',
  'amount', 5000, 'occurred_at', '2026-11-03T12:00:00+09:00')) as exp \gset
select public.create_account(:'biz', 'Biz bank', 'bank', 'KRW', 0) as biz_bank \gset
select public.post_transaction(jsonb_build_object(
  'workspace_id', :'biz', 'type', 'expense', 'account_id', :'biz_bank', 'category_id', :'biz_food',
  'amount', 777000, 'occurred_at', '2026-11-03T12:00:00+09:00')) as biz_exp \gset

-- SEC-1: Bob sees nothing of Alice's
select tests.authenticate_as(:'bob');
select is((select count(*)::int from public.workspaces where owner_id = :'alice'), 0, 'Bob cannot read Alice''s workspaces');
select is((select count(*)::int from public.profiles where id = :'alice'), 0, 'Bob cannot read Alice''s profile');
select is((select count(*)::int from public.accounts where workspace_id = :'ws'), 0, 'Bob cannot read Alice''s accounts');
select is((select count(*)::int from public.categories where workspace_id = :'ws'), 0, 'Bob cannot read Alice''s categories');
select is((select count(*)::int from public.transactions where workspace_id = :'ws'), 0, 'Bob cannot read Alice''s transactions');
select is((select count(*)::int from public.ledger_entries where workspace_id = :'ws'), 0, 'Bob cannot read Alice''s ledger entries');
select is_empty(format($$ select * from public.account_balances(%L) $$, :'ws'), 'Bob gets no balances for Alice''s workspace');
select is_empty(format($$ select * from public.period_totals(%L, '2026-11-01', '2026-11-30') $$, :'ws'), 'Bob gets no totals for Alice''s workspace');
select is_empty(format($$ update public.accounts set name = 'pwned' where id = %L returning id $$, :'bank'), 'Bob cannot rename Alice''s account');
select is_empty(format($$ update public.workspaces set name = 'pwned' where id = %L returning id $$, :'ws'), 'Bob cannot rename Alice''s workspace');
select throws_ok(format($$ insert into public.categories (workspace_id, name, kind) values (%L, 'Sneaky', 'expense') $$, :'ws'),
  '42501', null, 'Bob cannot add categories to Alice''s workspace');

-- GOV-1: writes to the ledger go only through the posting service
select tests.authenticate_as(:'alice');
select throws_ok(format($$ insert into public.transactions (workspace_id, type, occurred_at, currency, amount, account_id, category_id)
  values (%L, 'expense', now(), 'KRW', 1, %L, %L) $$, :'ws', :'bank', :'food'), '42501', null, 'direct transaction inserts are denied');
select throws_ok(format($$ insert into public.ledger_entries (transaction_id, workspace_id, account_id, amount, currency)
  values (%L, %L, %L, 1, 'KRW') $$, :'exp', :'ws', :'bank'), '42501', null, 'direct ledger inserts are denied');
select throws_ok($$ update public.transactions set amount = 1 $$, '42501', null, 'direct transaction updates are denied');
select throws_ok($$ delete from public.ledger_entries $$, '42501', null, 'direct ledger deletes are denied');
select throws_ok($$ insert into public.accounts (workspace_id, name, type, currency) values (gen_random_uuid(), 'x', 'cash', 'KRW') $$,
  '42501', null, 'accounts are created only through create_account');
select throws_ok(format($$ update public.accounts set currency = 'USD' where id = %L $$, :'bank'), '42501', null,
  'account currency cannot change after creation');
select lives_ok(format($$ update public.accounts set name = 'Main bank' where id = %L $$, :'bank'), 'Alice can rename her account');

-- Categories
select throws_ok(format($$ insert into public.categories (workspace_id, name, kind, is_system) values (%L, 'Fake', 'equity', true) $$, :'ws'),
  '42501', null, 'users cannot create system categories');
select is_empty(format($$ update public.categories set name = 'Hacked' where id = %L returning id $$, :'opening_cat'),
  'system categories are read-only');
select throws_ok($$ delete from public.categories $$, '42501', null, 'categories cannot be deleted (archive instead)');

-- FIN-9: personal and business never mix
select is((select balance from public.account_balances(:'ws') where account_id = :'biz_bank'), null,
  'business accounts do not appear in personal balances');
select is((select expense from public.period_totals(:'ws', '2026-11-01', '2026-11-30') where currency = 'KRW'), 5000::bigint,
  'business expenses do not appear in personal totals');
select throws_ok(format($$ select public.post_transaction('{"workspace_id": "%s", "type": "expense", "account_id": "%s", "category_id": "%s", "amount": 500, "occurred_at": "2026-11-03T12:00:00+09:00"}') $$, :'ws', :'biz_bank', :'food'),
  null, null, 'a personal transaction cannot use a business account');

-- Owners can edit their own workspace and profile (review fix)
select tests.authenticate_as(:'alice');
select lives_ok(format($$ update public.workspaces set name = 'Home' where id = %L $$, :'ws'), 'Alice can rename her workspace');
select lives_ok(format($$ update public.workspaces set timezone = 'Europe/London' where id = %L $$, :'ws'), 'Alice can change her workspace timezone');
select lives_ok(format($$ update public.profiles set display_name = 'Alice' where id = %L $$, :'alice'), 'Alice can update her profile');
select throws_ok(format($$ update public.workspaces set timezone = 'FOO+3' where id = %L $$, :'ws'), '23514', null,
  'non-IANA timezone strings are rejected');

-- anon has no table access
select tests.authenticate_as_anon();
select throws_ok($$ select * from public.accounts $$, '42501', null, 'anon cannot read accounts');
select throws_ok($$ select * from public.transactions $$, '42501', null, 'anon cannot read transactions');
select throws_ok($$ select * from public.audit_log $$, '42501', null, 'anon cannot read the audit log');

select * from finish();
rollback;
