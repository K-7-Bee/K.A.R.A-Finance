-- Phase 1a / Task 2: core schema.
--
-- Money is bigint minor units (KRW has none; USD cents). Balances are never
-- stored: they are always derived from ledger_entries. Every financial row
-- carries workspace_id, and composite foreign keys force related rows to live
-- in the same workspace (personal and business never mix).
--
-- Foreign keys from transactions/ledger_entries to accounts/categories are
-- DEFERRABLE INITIALLY DEFERRED: deleting a whole workspace (or user) removes
-- every dependent row before the checks run at commit. Deleting a single
-- account that still has history fails at commit.

-- Internal helpers live in `private`, which PostgREST does not expose.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.currencies (
  code char(3) primary key check (code ~ '^[A-Z]{3}$'),
  minor_unit smallint not null check (minor_unit between 0 and 4)
);

insert into public.currencies (code, minor_unit) values
  ('KRW', 0), ('USD', 2), ('EUR', 2), ('JPY', 0);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now()
);

create type public.workspace_kind as enum ('personal', 'business');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind public.workspace_kind not null default 'personal',
  name text not null check (char_length(name) between 1 and 100),
  base_currency char(3) not null default 'KRW' references public.currencies (code),
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now()
);

-- Timezones must be names Postgres knows (e.g. 'Asia/Seoul'). A trigger, not a
-- CHECK, because the lookup reads a catalog view and must not need any
-- privilege from the user making the update.
create or replace function private.validate_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone "%"', new.timezone using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function private.validate_timezone();

create trigger workspaces_validate_timezone
  before insert or update of timezone on public.workspaces
  for each row execute function private.validate_timezone();

create unique index workspaces_one_personal_per_owner
  on public.workspaces (owner_id) where kind = 'personal';

create type public.account_type as enum
  ('bank', 'cash', 'debit_card', 'credit_card', 'savings', 'investment');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  type public.account_type not null,
  currency char(3) not null references public.currencies (code),
  is_archived boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Targets for composite FKs: same workspace, same currency.
  unique (id, workspace_id, currency)
);

create index accounts_workspace_idx on public.accounts (workspace_id);

create type public.category_kind as enum ('income', 'expense', 'equity');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  kind public.category_kind not null,
  is_system boolean not null default false,
  -- Stable identifier for system rows ('opening_balance', 'balance_adjustment').
  system_key text,
  parent_id uuid,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, name),
  unique (workspace_id, system_key),
  unique (id, workspace_id),
  foreign key (parent_id, workspace_id) references public.categories (id, workspace_id)
    deferrable initially deferred,
  check (is_system = (system_key is not null)),
  check (parent_id is distinct from id),
  -- Equity categories exist only to back opening balances and adjustments.
  check (kind <> 'equity' or is_system)
);

create type public.transaction_type as enum
  ('income', 'expense', 'transfer', 'opening_balance', 'adjustment');
create type public.transaction_status as enum ('posted', 'void');
create type public.transaction_source as enum ('manual', 'import', 'receipt', 'assistant', 'rule');

-- User-facing record. Its ledger entries are fully determined by these columns
-- (see private.build_entries). For transfers, account_id is the source and
-- counter_account_id the destination.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type public.transaction_type not null,
  status public.transaction_status not null default 'posted',
  occurred_at timestamptz not null,
  currency char(3) not null references public.currencies (code),
  -- Positive for income/expense/transfer. Signed for opening_balance and
  -- adjustment, where the sign is the effect on the account.
  amount bigint not null,
  account_id uuid not null,
  counter_account_id uuid,
  category_id uuid,
  merchant text check (char_length(merchant) <= 200),
  description text check (char_length(description) <= 500),
  notes text check (char_length(notes) <= 2000),
  source public.transaction_source not null default 'manual',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (account_id, workspace_id, currency)
    references public.accounts (id, workspace_id, currency) deferrable initially deferred,
  foreign key (counter_account_id, workspace_id, currency)
    references public.accounts (id, workspace_id, currency) deferrable initially deferred,
  foreign key (category_id, workspace_id)
    references public.categories (id, workspace_id) deferrable initially deferred,
  check (amount <> 0 and (amount > 0 or type in ('opening_balance', 'adjustment'))),
  check ((type = 'transfer') = (counter_account_id is not null)),
  check ((type = 'transfer') = (category_id is null)),
  check (counter_account_id is distinct from account_id)
);

create index transactions_workspace_occurred_idx on public.transactions (workspace_id, occurred_at);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_counter_account_idx on public.transactions (counter_account_id);

-- Double-entry postings. Debit > 0, credit < 0. Each entry hits either an
-- account (asset/liability) or a category (income/expense/equity), never both.
create table public.ledger_entries (
  id bigint generated always as identity primary key,
  transaction_id uuid not null,
  workspace_id uuid not null,
  account_id uuid,
  category_id uuid,
  amount bigint not null check (amount <> 0),
  currency char(3) not null references public.currencies (code),
  foreign key (transaction_id, workspace_id)
    references public.transactions (id, workspace_id) on delete cascade,
  foreign key (account_id, workspace_id, currency)
    references public.accounts (id, workspace_id, currency) deferrable initially deferred,
  foreign key (category_id, workspace_id)
    references public.categories (id, workspace_id) deferrable initially deferred,
  check (num_nonnulls(account_id, category_id) = 1)
);

create index ledger_entries_transaction_idx on public.ledger_entries (transaction_id);
create index ledger_entries_account_idx on public.ledger_entries (account_id);
create index ledger_entries_category_idx on public.ledger_entries (category_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute function private.touch_updated_at();

-- Default categories for a new workspace.
create or replace function private.seed_default_categories(p_workspace_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (workspace_id, name, kind, is_system, system_key)
  values
    (p_workspace_id, 'Salary', 'income', false, null),
    (p_workspace_id, 'Other income', 'income', false, null),
    (p_workspace_id, 'Rent', 'expense', false, null),
    (p_workspace_id, 'Food', 'expense', false, null),
    (p_workspace_id, 'Transport', 'expense', false, null),
    (p_workspace_id, 'Shopping', 'expense', false, null),
    (p_workspace_id, 'Education', 'expense', false, null),
    (p_workspace_id, 'Entertainment', 'expense', false, null),
    (p_workspace_id, 'Subscriptions', 'expense', false, null),
    (p_workspace_id, 'Other', 'expense', false, null),
    (p_workspace_id, 'Opening balance', 'equity', true, 'opening_balance'),
    (p_workspace_id, 'Balance adjustment', 'equity', true, 'balance_adjustment');
$$;

-- On signup: profile, personal workspace, default categories.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  insert into public.profiles (id) values (new.id);
  insert into public.workspaces (owner_id, kind, name)
    values (new.id, 'personal', 'Personal')
    returning id into v_workspace_id;
  perform private.seed_default_categories(v_workspace_id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke all on all functions in schema private from public, anon, authenticated;
