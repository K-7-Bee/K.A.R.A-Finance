# Phase 1a: Scaffold and ledger foundation

Stage 1 (Core finance) is split into four sub-phases. This file plans 1a only.

| Sub-phase | Boundary | Scope |
| --- | --- | --- |
| **1a** | Tooling + database | Next.js/Supabase scaffold, schema, double-entry posting RPCs, audit log, RLS, aggregate functions, DB tests |
| 1b | Auth + app shell | Supabase Auth (email), session handling, personal workspace bootstrap, navigation shell, design tokens |
| 1c | Accounts + categories UI | Create accounts with opening balance, reconcile, archive; category management |
| 1d | Transactions + Overview | Add/edit/void/search income, expense, transfer; Overview dashboard from aggregate functions |

**Sources.** There is no `implementation_plan.md`, `requirements.md`, `design.md` or `technology_decisions.md`. The requirement IDs below come from [CLAUDE.md](CLAUDE.md) (financial rules and definition of done) and [docs/ai-governance.md](docs/ai-governance.md) (Stage 1 foundations):

| ID | Requirement |
| --- | --- |
| FIN-1 | Every posted transaction balances (double-entry) |
| FIN-2 | A transfer between own accounts changes both balances but is never income or expense |
| FIN-3 | Money is integer minor units, never floats |
| FIN-4 | Currency on every account and transaction; KRW default |
| FIN-5 | Related postings succeed or fail together in one DB transaction |
| FIN-6 | Audit trail for corrections and financial changes |
| FIN-7 | Timestamps stored as `timestamptz`; date ranges resolved in the workspace timezone |
| FIN-8 | Totals come from the ledger for the selected date range |
| FIN-9 | Personal and business workspaces never mix |
| SEC-1 | RLS: a user can never read or write another user's data |
| SEC-2 | Secrets server-side only, never committed |
| GOV-1 | Single posting service; every write path goes through it |
| GOV-2 | `source` and `created_by` on transactions; append-only `audit_log` |
| GOV-3 | Aggregates are reusable SQL functions (`SECURITY INVOKER`) |
| GOV-4 | RLS tests, including workspace isolation |
| DOD-ACC | Create accounts, set opening balances, reconcile (DB side) |

## Summary

| # | Task | Requirements |
| --- | --- | --- |
| 1 | Scaffold Next.js app and Supabase local tooling | SEC-2 |
| 2 | Core schema migration | FIN-3, FIN-4, FIN-7, FIN-9, GOV-2 |
| 3 | Ledger balance enforcement | FIN-1, FIN-2, FIN-4 |
| 4 | Posting service RPCs | FIN-1, FIN-2, FIN-5, GOV-1, DOD-ACC |
| 5 | Append-only audit log | FIN-6, GOV-2 |
| 6 | RLS policies and grants | SEC-1, FIN-9, GOV-1 |
| 7 | Aggregate SQL functions | FIN-2, FIN-7, FIN-8, GOV-3 |
| 8 | Database test suite (pgTAP) | GOV-4, FIN-1, FIN-2, SEC-1 |

## Dependencies

- [ ] **User approval to install dependencies before Task 1.** Proposed:
  - runtime: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`
  - dev: `typescript`, `@types/react`, `@types/node`, `tailwindcss`, `@tailwindcss/postcss`, `eslint`, `eslint-config-next`, `supabase` (CLI), `vitest`
- [x] Docker daemon running, for the local Supabase stack. Already verified.
- [x] Node 24 and pnpm available
- [ ] Supabase cloud project. **Not needed for 1a.** Everything runs locally.

---

## Tasks

### Task 1: Scaffold Next.js app and Supabase local tooling

**What:** Create a Next.js (App Router, TypeScript, Tailwind) app at the repo root and initialise local Supabase.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx` (placeholder only)
- Create: `src/app/globals.css`, with the KARA tokens (Midnight, Violet, Mint, Blue, Amber, Coral, Cloud) as Tailwind theme variables
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `.env.example`, with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and no service-role key
- Create: `.gitignore`, ignoring `.env*` except `.env.example`, plus `.next`, `node_modules` and `supabase/.temp`
- Modify: `CLAUDE.md`, filling in the Commands section with:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm db:start`
  - `pnpm db:reset`
  - `pnpm db:test`
  - `pnpm db:new <name>`

**AC:**
- [ ] `pnpm build` and `pnpm lint` succeed
- [ ] `pnpm db:start` brings up local Supabase, and `pnpm db:reset` applies all migrations from scratch
- [ ] No secret values are committed. `git grep -i service_role` matches nothing outside docs (SEC-2)

---

### Task 2: Core schema migration

**What:** Create the Stage 1 tables with types, constraints and seed data. Balances are never stored; they are always derived from `ledger_entries`.

**Files:**
- Create: `supabase/migrations/0001_core_schema.sql`

**Schema:**
- **`currencies`** (`code char(3)` PK, `minor_unit smallint`). Seed KRW 0, USD 2, EUR 2, JPY 0.
- **`profiles`** (`id` → `auth.users` PK, `display_name`, `timezone text default 'Asia/Seoul'`, `created_at`)
- **`workspaces`**
  - Columns: `id`, `owner_id` → `auth.users`, `kind` (`personal` | `business`), `name`, `base_currency` → `currencies` default `'KRW'`, `timezone`, `created_at`
  - Partial unique index: one `personal` workspace per owner
- **`accounts`**
  - Columns: `id`, `workspace_id`, `name`, `type`, `currency` → `currencies`, `is_archived`, `created_by`, `created_at`
  - `type` is one of `bank`, `cash`, `debit_card`, `credit_card`, `savings`, `investment`
- **`categories`**
  - Columns: `id`, `workspace_id`, `name`, `kind`, `is_system bool`, `parent_id` nullable, `is_archived`
  - `kind` is one of `income`, `expense`, `equity`
  - Unique (`workspace_id`, `kind`, `name`)
- **`transactions`**
  - Core columns: `id`, `workspace_id`, `type`, `status` (`posted` | `void`), `occurred_at timestamptz`, `currency`, `amount bigint check (amount > 0)`
  - `type` is one of `income`, `expense`, `transfer`, `opening_balance`, `adjustment`
  - References: `account_id`, `counter_account_id` (for transfers), `category_id`
  - Text: `merchant`, `description`, `notes`
  - Provenance: `source` (`manual` | `import` | `receipt` | `assistant` | `rule`, default `manual`), `created_by`, `created_at`, `updated_at`
- **`ledger_entries`**
  - Columns: `id`, `transaction_id` (on delete cascade), `workspace_id`, `account_id` nullable, `category_id` nullable, `amount bigint` (signed: debit > 0, credit < 0, never 0), `currency`
  - CHECK: exactly one of `account_id` and `category_id` is set
- **Indexes:**
  - `ledger_entries (account_id)`
  - `ledger_entries (category_id)`
  - `transactions (workspace_id, occurred_at)`
- **`handle_new_user()` trigger on `auth.users` insert.** It creates:
  - the profile
  - the personal workspace
  - default categories:
    - Income: Salary, Other income
    - Expense: Rent, Food, Transport, Shopping, Education, Entertainment, Subscriptions, Other
    - System equity: Opening balance, Balance adjustment

**AC:**
- [ ] No `float`, `real`, `double precision` or `numeric` without scale on any money column. Money columns are `bigint` minor units (FIN-3).
- [ ] Every account, transaction and ledger entry has a non-null `currency` FK; workspaces default to KRW (FIN-4)
- [ ] All time columns are `timestamptz`; workspaces store an IANA timezone (FIN-7)
- [ ] Every financial row carries `workspace_id`. FKs from `ledger_entries` and `transactions` to accounts and categories must be in the same workspace, enforced by trigger or composite FK (FIN-9).
- [ ] Signing up a user creates exactly one personal workspace with the default categories

---

### Task 3: Ledger balance enforcement

**What:** Database-level guarantees that no posted transaction can be unbalanced or mismatched, whatever path wrote it.

**Files:**
- Create: `supabase/migrations/0002_ledger_constraints.sql`

**Rules:**
- A **deferred constraint trigger** (`DEFERRABLE INITIALLY DEFERRED`) on `ledger_entries` and `transactions` checks, at commit:
  - for each `posted` transaction, `sum(amount) = 0`
  - the transaction has ≥ 2 entries
  - every entry's currency equals the transaction currency
- Entry currency equals the referenced account's currency.
- **Shape rules by type**, enforced in the same trigger. They keep transfers out of income and expense by construction (FIN-2):
  - `income`: Dr an asset/liability account, Cr an `income` category
  - `expense`: Dr an `expense` category, Cr an account
  - `transfer`: Dr `counter_account_id`, Cr `account_id`
    - no category entries
    - the two accounts must differ
    - both accounts are in the same workspace
  - `opening_balance` and `adjustment`: one account entry plus one `equity` system category entry
- A `void` transaction has its ledger entries removed (still in the same DB transaction), so it contributes nothing.
- **Stage 1 limitation:** cross-currency transfers are rejected with a clear error. Multi-currency FX is out of scope.

**AC:**
- [ ] An insert producing an unbalanced posted transaction fails at commit, and nothing persists (FIN-1, FIN-5)
- [ ] A transfer with a category entry is rejected; a transfer to the same account is rejected (FIN-2)
- [ ] A currency mismatch between an entry and its account is rejected (FIN-4)

---

### Task 4: Posting service RPCs

**What:** The single write path for financial records. These are `SECURITY DEFINER` Postgres functions, each running in one DB transaction, that check ownership via `auth.uid()`.

**Files:**
- Create: `supabase/migrations/0003_posting_service.sql`

**Functions:**
- **`post_transaction(p jsonb) returns uuid`**
  - Validates the input:
    - workspace owned by the caller
    - account and category belong to that workspace and are not archived
    - `amount` is a positive integer
    - currency matches the account
    - `type` is allowed
  - Builds the ledger entries from `type`.
  - Sets `created_by = auth.uid()`. `source` comes from input, default `manual`, and is limited to the allowed enum.
- **`update_transaction(id uuid, p jsonb)`**
  - Replaces fields and rebuilds the entries atomically.
  - Rejects edits to `void` transactions.
- **`void_transaction(id uuid, reason text)`**
- **`create_account(workspace_id, name, type, currency, opening_balance bigint, opening_date date) returns uuid`**
  - Creates the account.
  - If `opening_balance ≠ 0`, also posts an `opening_balance` transaction.
  - Negative values are allowed, e.g. a credit card that already carries debt.
- **`reconcile_account(account_id, actual_balance bigint, as_of timestamptz) returns uuid | null`**
  - Computes the ledger balance as of `as_of`.
  - If it differs from `actual_balance`, posts an `adjustment` for the difference. Otherwise it returns null.

**Guards:**
- Every function `SET search_path = ''` and uses schema-qualified names.
- `EXECUTE` is revoked from `public` and `anon` and granted to `authenticated` only.

**AC:**
- [ ] These five functions are the only way to create or change `transactions` and `ledger_entries` (GOV-1)
- [ ] A failure partway through any function leaves no partial rows (FIN-5)
- [ ] Calling any function on another user's workspace, account or transaction raises an error and writes nothing (SEC-1)
- [ ] Opening balance and reconciliation produce balanced equity-backed postings (DOD-ACC)

---

### Task 5: Append-only audit log

**What:** Record every change to financial and configuration tables with before and after snapshots.

**Files:**
- Create: `supabase/migrations/0004_audit_log.sql`

**Design:**
- **`audit_log`** columns:
  - `id bigint identity`, `occurred_at timestamptz default now()`
  - `actor_id` (`auth.uid()`), `workspace_id`, `table_name`, `row_id`
  - `action` (`insert` | `update` | `delete` | `void`)
  - `before jsonb`, `after jsonb`
  - `source`, `reason text`
- A generic `SECURITY DEFINER` trigger writes the audit rows. It is attached to `accounts`, `categories`, `transactions` and `workspaces`.
- `void_transaction` records its `reason` in the audit row.
- `UPDATE`, `DELETE` and `TRUNCATE` on `audit_log` are revoked from all non-superuser roles, and a `BEFORE UPDATE OR DELETE` trigger raises an exception.

**AC:**
- [ ] Every RPC call in Task 4 produces audit rows with the correct actor and before/after values (FIN-6, GOV-2)
- [ ] `update` and `delete` on `audit_log` fail for `authenticated` and `service_role` (append-only)
- [ ] Users can `SELECT` only audit rows for their own workspaces

---

### Task 6: RLS policies and grants

**What:** Least-privilege access for every table.

**Files:**
- Create: `supabase/migrations/0005_rls.sql`

**Policies:**
- RLS is enabled on every table in `public`.
- A helper `is_workspace_owner(ws uuid) returns bool` (`SECURITY DEFINER`, `STABLE`) backs the policies.
- `transactions`, `ledger_entries` and `audit_log` get `SELECT` only, for workspace owners. There are no `INSERT`, `UPDATE` or `DELETE` grants to `authenticated`; all writes go through Task 4.
- `accounts`: `SELECT` for owners. Create goes through `create_account`. `UPDATE` is limited to `name` and `is_archived` through a column-level grant; `currency` and `type` can't change after creation.
- `categories`:
  - `SELECT`, `INSERT` and `UPDATE` for owners on non-system rows
  - system rows are read-only
  - no `DELETE`; archive instead
- `workspaces` and `profiles`: owners can `SELECT` their own rows and `UPDATE` `name` and `timezone`.
- `currencies`: `SELECT` for `authenticated`.
- `anon` has no access to any table.

**AC:**
- [ ] User B gets zero rows from every table for user A's data, and gets an error writing to it (SEC-1)
- [ ] Direct `INSERT` into `transactions` or `ledger_entries` as `authenticated` is denied (GOV-1)
- [ ] Rows in a second workspace (`kind = business`, inserted by test fixture) never appear in personal-workspace queries or aggregates (FIN-9)

---

### Task 7: Aggregate SQL functions

**What:** The functions the dashboard uses now and that later become the AI assistant's read-only tools. They are `SECURITY INVOKER`, so RLS applies.

**Files:**
- Create: `supabase/migrations/0006_aggregates.sql`

**Functions:**
- **`account_balances(ws uuid, as_of timestamptz default now())`**
  - Returns `(account_id, name, type, currency, balance bigint)`.
  - Each balance is the sum of that account's ledger entries with `occurred_at <= as_of`.
- **`period_totals(ws uuid, from_date date, to_date date)`**
  - Returns `(currency, income bigint, expense bigint, net bigint)`.
  - It sums only category-side entries of kind `income`/`expense`, so transfers, opening balances and adjustments are excluded by construction.
  - The dates are inclusive and resolved in the workspace timezone.
- **`category_totals(ws uuid, from_date date, to_date date)`**
  - Returns `(category_id, name, kind, currency, total bigint)`, using the same rules as `period_totals`.
- **`ledger_integrity_check(ws uuid)`**
  - Returns posted transactions whose entries don't sum to 0. This should always be empty.

**AC:**
- [ ] A transfer of any size leaves `period_totals` income and expense unchanged (FIN-2)
- [ ] A transaction at 23:30 KST on the last day of the month counts in that month, not the next (FIN-7)
- [ ] The sum of `account_balances` equals the sum of all account-side ledger entries (FIN-8)
- [ ] Results are grouped by currency; amounts in different currencies are never summed together (FIN-4)

---

### Task 8: Database test suite (pgTAP)

**What:** Automated tests that prove Tasks 2–7, run with `supabase test db`.

**Files:**
- Create: `supabase/tests/00_helpers.sql`, with fixtures that create two users, two personal workspaces and one business workspace, plus `set_auth(user)` to impersonate a user via `request.jwt.claims`
- Create the test files listed in the Tests table below
- Modify: `package.json`, adding the `db:test` script

**AC:**
- [ ] `pnpm db:test` passes from a clean `pnpm db:reset`
- [ ] Each AC in Tasks 2–7 marked with a requirement ID is covered by at least one assertion
- [ ] `ledger_integrity_check` returns empty after every test scenario

---

## Tests

| Test | File | Verifies |
| --- | --- | --- |
| Signup bootstrap | `supabase/tests/01_bootstrap.test.sql` | One personal workspace and default categories per new user |
| Unbalanced posting rejected | `supabase/tests/02_ledger.test.sql` | Deferred trigger rejects sum ≠ 0; nothing persists |
| Transaction shapes | `supabase/tests/02_ledger.test.sql` | Income, expense, transfer and opening-balance entries are correct; invalid shapes are rejected |
| Currency mismatch | `supabase/tests/02_ledger.test.sql` | Entry/account currency mismatch and cross-currency transfer are rejected |
| Posting RPCs | `supabase/tests/03_posting.test.sql` | post, update, void, create_account and reconcile produce correct balances and are atomic |
| Transfer neutrality | `supabase/tests/03_posting.test.sql` | Transfer moves both balances; `period_totals` income and expense unchanged |
| Opening balance + reconcile | `supabase/tests/03_posting.test.sql` | Opening balance sets the balance; reconcile posts the exact difference, or nothing |
| Audit trail | `supabase/tests/04_audit.test.sql` | Every RPC writes audit rows with the actor; update and delete on `audit_log` fail |
| RLS isolation | `supabase/tests/05_rls.test.sql` | User B can't read or write A's rows or call RPCs on A's workspace; direct ledger inserts are denied |
| Workspace separation | `supabase/tests/05_rls.test.sql` | Business workspace rows never appear in personal aggregates |
| Aggregates and timezone | `supabase/tests/06_aggregates.test.sql` | Month boundaries in Asia/Seoul; per-currency grouping; balances match ledger |
