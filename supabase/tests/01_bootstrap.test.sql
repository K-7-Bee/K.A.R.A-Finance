-- Task 2: core schema and signup bootstrap.
begin;
select plan(15);

select tests.create_user('alice@test.local') as alice \gset
select tests.personal_ws(:'alice') as ws \gset

-- Signup provisioning
select is((select count(*)::int from public.workspaces where owner_id = :'alice'), 1,
  'signup creates exactly one workspace');
select is((select kind::text from public.workspaces where id = :'ws'), 'personal',
  'the workspace is personal');
select is((select base_currency::text from public.workspaces where id = :'ws'), 'KRW',
  'KRW is the default currency (FIN-4)');
select is((select timezone from public.workspaces where id = :'ws'), 'Asia/Seoul',
  'workspace has an IANA timezone (FIN-7)');
select is((select count(*)::int from public.profiles where id = :'alice'), 1,
  'signup creates a profile');
select is((select count(*)::int from public.categories where workspace_id = :'ws' and kind = 'expense'), 8,
  'eight default expense categories');
select is((select count(*)::int from public.categories where workspace_id = :'ws' and kind = 'income'), 2,
  'two default income categories');
select set_eq(
  $$ select system_key from public.categories where workspace_id = $$ || quote_literal(:'ws') || $$ and kind = 'equity' $$,
  array['opening_balance', 'balance_adjustment'],
  'system equity categories for opening balances and adjustments');

select throws_ok(
  format($$ insert into public.workspaces (owner_id, kind, name) values (%L, 'personal', 'Second') $$, :'alice'),
  '23505', null, 'a user cannot have a second personal workspace');

select throws_ok(
  format($$ update public.workspaces set timezone = 'Mars/Olympus' where id = %L $$, :'ws'),
  '23514', null, 'invalid timezones are rejected');
select throws_ok(
  format($$ update public.workspaces set timezone = 'Factory' where id = %L $$, :'ws'),
  '23514', null, 'Postgres-only pseudo zones such as Factory are rejected');

-- FIN-3: no binary floating point or unscaled numeric anywhere in public tables
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and data_type in ('real', 'double precision', 'numeric')),
  0, 'no float or numeric columns in public tables (FIN-3)');

select col_type_is('public', 'ledger_entries', 'amount', 'bigint', 'ledger amounts are bigint minor units');

-- FIN-7: every timestamp column is timestamptz
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and data_type = 'timestamp without time zone'),
  0, 'all timestamp columns are timestamptz (FIN-7)');

select is((select minor_unit::int from public.currencies where code = 'KRW'), 0,
  'KRW has no minor unit');

select * from finish();
rollback;
