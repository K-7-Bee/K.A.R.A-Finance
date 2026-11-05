-- Task 5: append-only audit log.
begin;
select plan(14);

select tests.create_user('alice@test.local') as alice \gset
select tests.create_user('bob@test.local') as bob \gset
select tests.personal_ws(:'alice') as ws \gset
select tests.personal_ws(:'bob') as bob_ws \gset
select tests.category(:'ws', 'Food') as food \gset

select tests.authenticate_as(:'alice');
select public.create_account(:'ws', 'Bank', 'bank', 'KRW', 100000, '2026-01-01') as bank \gset
select public.post_transaction(jsonb_build_object(
  'workspace_id', :'ws', 'type', 'expense', 'account_id', :'bank', 'category_id', :'food',
  'amount', 5000, 'occurred_at', '2026-11-03T12:00:00+09:00')) as exp \gset
select public.update_transaction(:'exp', '{"amount": 6000}');
select public.void_transaction(:'exp', 'duplicate entry');
insert into public.categories (workspace_id, name, kind) values (:'ws', 'Pets', 'expense');

select is((select count(*)::int from public.audit_log where table_name = 'accounts' and row_id = :'bank' and action = 'insert'), 1,
  'account creation is audited');
select is((select actor_id from public.audit_log where table_name = 'accounts' and row_id = :'bank'), :'alice'::uuid,
  'audit rows record the acting user');
select is((select count(*)::int from public.audit_log where table_name = 'transactions' and action = 'insert'
            and after->>'type' = 'opening_balance'), 1, 'the opening balance posting is audited');
select is((select source from public.audit_log where table_name = 'transactions' and row_id = :'exp' and action = 'insert'), 'manual',
  'audit rows record the transaction source (GOV-2)');
select is(
  (select array[before->>'amount', after->>'amount'] from public.audit_log
    where table_name = 'transactions' and row_id = :'exp' and action = 'update'),
  array['5000', '6000'], 'edits keep before and after values (FIN-6)');
select is((select reason from public.audit_log where table_name = 'transactions' and row_id = :'exp' and action = 'void'),
  'duplicate entry', 'voids are audited with their reason');
select is((select count(*)::int from public.audit_log where table_name = 'categories' and after->>'name' = 'Pets'), 1,
  'category changes are audited');

-- Append-only
select throws_ok($$ update public.audit_log set reason = 'tampered' $$, '42501', null, 'users cannot update the audit log');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'users cannot delete from the audit log');

select tests.clear_authentication();
set local role service_role;
select throws_ok($$ update public.audit_log set reason = 'tampered' $$, null, null, 'service_role cannot update the audit log');
select throws_ok($$ delete from public.audit_log $$, null, null, 'service_role cannot delete from the audit log');
select throws_ok($$ insert into public.audit_log (table_name, action, reason) values ('transactions', 'void', 'forged') $$,
  '42501', null, 'service_role cannot forge audit rows');
reset role;

-- Visibility
select tests.authenticate_as(:'bob');
select public.create_account(:'bob_ws', 'Bob bank', 'bank');
select is((select count(*)::int from public.audit_log where workspace_id = :'ws'), 0,
  'Bob cannot see Alice''s audit rows');
select tests.authenticate_as(:'alice');
select is((select count(*)::int from public.audit_log where workspace_id <> :'ws'), 0,
  'Alice sees only her own workspace''s audit rows');

select * from finish();
rollback;
