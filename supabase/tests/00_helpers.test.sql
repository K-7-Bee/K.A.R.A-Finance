-- Test helpers for the local database only. pg_prove runs files in name order,
-- so this file runs first and COMMITs the helpers for the files that follow.
-- These objects never ship: migrations do not create the `tests` schema, and
-- 99_teardown.test.sql drops it after the run.
begin;

create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated, service_role;

-- Create an auth user. The on-signup trigger provisions profile, workspace, categories.
create or replace function tests.create_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, '', now(), now(), now(), '{}', '{}'
  );
  return v_id;
end;
$$;

-- Act as a signed-in user for the rest of the transaction (RLS applies).
create or replace function tests.authenticate_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Act as an unauthenticated visitor.
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end;
$$;

-- Back to the session role (postgres, bypasses RLS) for fixture setup and inspection.
create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;

-- Lookups that bypass RLS so assertions can name rows owned by any user.
create or replace function tests.user_id(p_email text)
returns uuid language sql stable security definer set search_path = ''
as $$ select id from auth.users where email = p_email $$;

create or replace function tests.personal_ws(p_user uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.workspaces where owner_id = p_user and kind = 'personal' $$;

create or replace function tests.category(p_ws uuid, p_name text)
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.categories where workspace_id = p_ws and name = p_name $$;

-- Ledger balance of one account, straight from ledger_entries (no aggregate functions).
create or replace function tests.balance(p_account uuid)
returns bigint language sql stable security definer set search_path = ''
as $$ select coalesce(sum(amount), 0)::bigint from public.ledger_entries where account_id = p_account $$;

-- Run all deferred constraint checks now, as COMMIT would. Raises if any fail.
create or replace function tests.flush_constraints()
returns void
language plpgsql
as $$
begin
  set constraints all immediate;
  set constraints all deferred;
end;
$$;

-- Insert a transaction header and raw ledger entries, bypassing the posting
-- service, then run deferred checks. Used to prove the database itself rejects
-- invalid ledgers whatever code path wrote them.
create or replace function tests.raw_txn(
  p_ws uuid,
  p_type text,
  p_account uuid,
  p_counter uuid,
  p_category uuid,
  p_amount bigint,
  p_entries jsonb,
  p_currency text default 'KRW',
  p_status text default 'posted'
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  execute format(
    'insert into public.transactions
       (workspace_id, type, status, occurred_at, currency, amount,
        account_id, counter_account_id, category_id, description)
     values ($1, %L::public.transaction_type, %L::public.transaction_status, now(), $2, $3, $4, $5, $6, %L)
     returning id', p_type, p_status, 'raw')
  into v_id
  using p_ws, p_currency, p_amount, p_account, p_counter, p_category;

  insert into public.ledger_entries (transaction_id, workspace_id, account_id, category_id, amount, currency)
  select v_id, p_ws,
         (e->>'account_id')::uuid, (e->>'category_id')::uuid,
         (e->>'amount')::bigint, coalesce(e->>'currency', p_currency)
  from jsonb_array_elements(p_entries) e;

  perform tests.flush_constraints();
  return v_id;
end;
$$;

grant execute on all functions in schema tests to authenticated, service_role;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
commit;
