# Phase 1c: Accounts and categories

Stage 1 sub-phase 1c. 1a (ledger) and 1b (auth and shell) are on `main`; 1d (transactions and Overview) follows.

**Sources.** There is no `implementation_plan.md`, `requirements.md`, `design.md` or `technology_decisions.md`. Requirements come from [CLAUDE.md](CLAUDE.md) (Accounts definition of done, financial rules, design system), blueprint Screen 3 and Screen 4's category list, and the 1a/1b code.

| ID | Requirement |
| --- | --- |
| DOD-ACC | Users can create accounts, set opening balances and reconcile balances |
| CAT-1 | Users can add, rename and archive income and expense categories; system categories stay hidden and read-only |
| FIN-3 | Amounts entered and shown as exact integer minor units |
| FIN-4 | Each account has one currency; totals are per currency and never mixed |
| FIN-6 | Corrections are audited (the 1a audit triggers cover every write below) |
| GOV-1 | Ledger writes only through posting functions; balances only from `account_balances` |
| SEC-1 | Users act only on their own workspace; ids from forms are re-checked by RLS and the functions |
| UX-1 | Colour carries meaning (Blue for accounts, Coral for negative or owed, Mint for positive); responsive; accessible |

**Already available from 1a (reuse, don't rebuild):**
- `create_account` (with opening balance), `reconcile_account`, `account_balances`
- column grants letting the owner rename and archive accounts, and insert, rename and archive categories

**Gap this phase closes:** an opening balance can only be set at creation. There's no way to add, change or remove one later. Task 1 adds `set_opening_balance`.

**Decisions made in this plan** (flag if you disagree):
- **Credit cards take "amount you owe".** The form asks for a positive number and stores it as a negative balance (a liability). Every other type takes the balance as-is, and a negative one is allowed for an overdraft.
- **No account transaction history in 1c.** The account page shows the balance, opening balance and reconciliation. Per-account history comes with the transaction list in 1d.
- **No "available balance" or credit limits.** There's no data for them yet.
- **Categories are flat.** `parent_id` exists in the schema but stays unused.
- **TypeScript types are generated from the database** with the Supabase CLI already installed. No new dependency.

## Summary

| # | Task | Requirements |
| --- | --- | --- |
| 1 | `set_opening_balance` posting function | DOD-ACC, GOV-1, FIN-6 |
| 2 | Generated DB types and a data-access layer | GOV-1, SEC-1, FIN-4 |
| 3 | Error mapping and amount-input rules | FIN-3, SEC-1 |
| 4 | Accounts list page | DOD-ACC, FIN-4, UX-1 |
| 5 | Create account | DOD-ACC, FIN-3, FIN-4 |
| 6 | Account page: rename, archive, opening balance | DOD-ACC, FIN-6 |
| 7 | Reconcile account | DOD-ACC, GOV-1 |
| 8 | Categories page | CAT-1 |

## Dependencies

- [x] 1a and 1b merged to `main` (migrations 001–008; auth, shell, `getPersonalWorkspace`, `formatMoney`, `parseMoneyInput`)
- [x] Local Supabase, Mailpit, Playwright and Chromium working
- [ ] No new packages needed

---

## Tasks

### Task 1: `set_opening_balance` posting function

**What:** A new SECURITY DEFINER function to add, change or remove an account's opening balance after creation.

**Files:**
- Create: `supabase/migrations/20261105000009_set_opening_balance.sql`
- Create: `supabase/tests/07_opening_balance.test.sql`

**Function:** `public.set_opening_balance(p_account_id uuid, p_amount bigint, p_opening_date date default null) returns uuid`
- Checks that the caller owns the account's workspace (same pattern as `reconcile_account`).
- Locks the account row `FOR UPDATE`.
- Rejects archived accounts.
- Caps the amount at 1e15.
- Finds the account's posted `opening_balance` transaction:
  - if one exists and `p_amount ≠ 0`, update its amount and date and rebuild the entries
  - if one exists and `p_amount = 0`, void it with reason "Opening balance removed"
  - if none exists and `p_amount ≠ 0`, insert one (same shape as `create_account`)
- The date is local midnight in the workspace timezone. It defaults to the existing date, or today.
- Returns the opening transaction id, or null when the balance is removed.
- `EXECUTE` is granted to `authenticated` only.

**AC:**
- [ ] Setting a balance on an account created with 0 posts one balanced `opening_balance` transaction (DOD-ACC, GOV-1)
- [ ] Changing it updates that same transaction; there's never more than one posted opening balance per account
- [ ] Setting 0 voids it, and the balance drops by the old amount
- [ ] Every change writes `audit_log` rows with before and after values (FIN-6)
- [ ] Another user calling it on your account gets `42501` and nothing changes (SEC-1)
- [ ] `ledger_integrity_check` stays empty

---

### Task 2: Generated DB types and data-access layer

**What:** Typed Supabase access, with every query for accounts and categories in one place.

**Files:**
- Create: `src/lib/database.types.ts`, generated by `supabase gen types typescript --local`
- Modify: `package.json`, adding `"db:types": "supabase gen types typescript --local > src/lib/database.types.ts"`
- Modify: `src/lib/supabase/server.ts` and `client.ts`, passing the `Database` generic
- Create: `src/lib/data/currencies.ts`, providing `getCurrencies()` (code and minor unit; cached per request)
- Create: `src/lib/data/accounts.ts`
  - `listAccounts(workspaceId, { includeArchived })`, via the `account_balances` RPC
  - `getAccount(id)`, which joins the balance and the posted opening-balance transaction (amount and date)
- Create: `src/lib/data/categories.ts`, providing `listCategories(workspaceId, { includeArchived })`. It returns income and expense only and never the `is_system` rows.
- Modify: `CLAUDE.md`, adding `pnpm db:types` to Commands with a note to run it after every migration

**AC:**
- [ ] All balances come from `account_balances`; no TypeScript code adds up ledger entries (GOV-1)
- [ ] Every query runs with the user's session; ids are passed through, and RLS decides access (SEC-1)
- [ ] `pnpm typecheck` passes with the generated types; regenerating produces no diff

---

### Task 3: Error mapping and amount-input rules

**What:** Pure helpers that turn database errors into user messages and form input into signed minor units.

**Files:**
- Create: `src/lib/db-errors.ts`, providing `toUserMessage(error)`:
  - `42501` or "workspace not found" → "Not found."
  - `22023` → the function's own message (these are written by us and safe to show)
  - `23505` on a category name → "A category with that name already exists."
  - `23514` → "That value isn't allowed."
  - anything else → a generic message, logged server-side with its code only
- Create: `src/lib/accounts.ts`
  - `ACCOUNT_TYPES`, with labels: Bank, Cash, Debit card, Credit card, Savings, Investment
  - `isLiability(type)`
  - `toSignedOpening(type, enteredMinor)`: credit card → `-entered`
  - `fromSignedOpening(type, storedMinor)`: the inverse, used to pre-fill forms
- Create: `src/lib/db-errors.test.ts` and `src/lib/accounts.test.ts`

**AC:**
- [ ] A raw Postgres message (constraint name, SQL text) is never returned to the client (SEC-1)
- [ ] Credit card: entering `200,000` stores `-200000`; editing shows `200,000` again (FIN-3)
- [ ] A negative entry for a credit card ("owe a negative amount") is rejected with a clear message

---

### Task 4: Accounts list page

**What:** `/accounts`, showing every account with its current balance and per-currency totals.

**Files:**
- Modify: `src/app/(app)/accounts/page.tsx`
- Create: `src/components/accounts/account-list.tsx`

**Layout:**
- Header with an "Add account" button.
- One card per account: name, type label, balance formatted in its currency, and an "Archived" badge.
  - Negative balances are Coral-tinted text with a minus sign. Colour is never the only signal.
  - Credit cards show "Owed ₩200,000".
- A totals row per currency: "Total (KRW)" and "Total (USD)". Different currencies are never added together. The totals are labelled "Net" because liabilities are included.
- A "Show archived" toggle via the `?archived=1` search param. Archived accounts are excluded from totals.
- Empty state: "No accounts yet", with an "Add account" button.

**AC:**
- [ ] Balances match `account_balances` exactly (GOV-1)
- [ ] With KRW and USD accounts, two separate totals are shown and nothing is summed across currencies (FIN-4)
- [ ] At 375px, cards stack and there's no horizontal scroll; amounts are right-aligned with tabular numbers (UX-1)

---

### Task 5: Create account

**What:** `/accounts/new`, a form that creates an account through `create_account`.

**Files:**
- Create: `src/app/(app)/accounts/new/page.tsx`
- Create: `src/app/(app)/accounts/actions.ts`, providing `createAccount` (Server Action)
- Create: `src/components/accounts/account-form.tsx`

**Form fields:**
- Name: 1–100 characters
- Type: a select of the 6 types
- Currency: a select from `currencies`, defaulting to the workspace base currency
- Opening balance: optional, empty means 0
  - for credit cards the label is "Amount you owe now"
  - otherwise it's "Current balance"
- Opening date: defaults to today in the workspace timezone

**Action:**
- validates the inputs
- parses the amount with `parseMoneyInput` using the selected currency's minor unit
- applies `toSignedOpening`
- calls `create_account` with the workspace id from `getPersonalWorkspace()`, never from the form
- redirects to `/accounts/<id>`

**AC:**
- [ ] Creating "Bank" with `1,000,000` KRW shows a balance of ₩1,000,000 on the list and the account page (DOD-ACC)
- [ ] `12.345` for USD and `12.5` for KRW are rejected with a field error before any database call (FIN-3)
- [ ] A tampered currency not in `currencies` is rejected; a tampered workspace id is ignored (SEC-1)

---

### Task 6: Account page: rename, archive, opening balance

**What:** `/accounts/[id]`, showing the account's details and the edits allowed on them.

**Files:**
- Create: `src/app/(app)/accounts/[id]/page.tsx`. A missing or foreign id gets `notFound()`.
- Modify: `src/app/(app)/accounts/actions.ts`, adding:
  - `renameAccount`: a direct update of `name`, allowed by the column grant
  - `setArchived`: a direct update of `is_archived`
  - `setOpeningBalance`: calls `set_opening_balance`
- Create: `src/components/accounts/opening-balance-form.tsx` and `src/components/accounts/account-settings-form.tsx`

**Page contents:**
- header: name, type, currency, current balance
- opening balance: amount and date, with an edit form
- rename form
- Archive or Unarchive button. Archiving asks for confirmation with a native `<dialog>` or a second-step button.
- "Reconcile" link

The type and currency are shown read-only; the database forbids changing them.

**AC:**
- [ ] Changing the opening balance from ₩1,000,000 to ₩1,200,000 raises the current balance by ₩200,000 (DOD-ACC)
- [ ] An archived account still shows its balance but can't be reconciled or have its opening balance edited, and the UI explains why
- [ ] Visiting another user's account id returns the 404 page (SEC-1)
- [ ] Each change appears in `audit_log` (FIN-6). This is covered by a pgTAP test in Task 1 and the 1a audit tests.

---

### Task 7: Reconcile account

**What:** `/accounts/[id]/reconcile`, where the user enters the real balance from their bank and the app posts the difference.

**Files:**
- Create: `src/app/(app)/accounts/[id]/reconcile/page.tsx`
- Create: `src/components/accounts/reconcile-form.tsx`
- Modify: `src/app/(app)/accounts/actions.ts`, adding `reconcileAccount`, which calls `reconcile_account`

**Page:**
- Shows the current ledger balance from `account_balances`.
- Form: the actual balance (credit cards: "amount you owe"), and "as of" (defaults to now). The date is local, converted to the end of that day in the workspace timezone.
- After submitting:
  - "Balance already matches. Nothing changed.", or
  - "Adjustment of −₩30,000 posted. Balance is now ₩800,000."
  - The adjustment and new balance in that message are read back from the database, never computed in the browser.

**AC:**
- [ ] Reconciling ₩830,000 to ₩800,000 posts a −₩30,000 adjustment, and the account shows ₩800,000 (DOD-ACC)
- [ ] Reconciling to the same balance posts nothing and says so
- [ ] The amounts in the result message come from the database after the function returns (GOV-1)

---

### Task 8: Categories page

**What:** `/categories`, for managing income and expense categories.

**Files:**
- Create: `src/app/(app)/categories/page.tsx`
- Create: `src/app/(app)/categories/actions.ts`, with Server Actions:
  - `addCategory`, which inserts `workspace_id` from `getPersonalWorkspace()`, plus `name` and `kind`
  - `renameCategory`
  - `setCategoryArchived`
- Create: `src/components/categories/category-list.tsx` and `src/components/categories/add-category-form.tsx`
- Modify: `src/lib/navigation.ts`
  - adds "Categories" at stage 1, mobile under More
  - placed after Accounts in the sidebar
  - updates `navigation.test.ts`

**Page:**
- Two sections, Income and Expense, each with an add form (name).
- Each row has inline rename and archive or unarchive.
- Archived rows are listed separately and greyed, with a text label.
- System equity categories are never shown.

**AC:**
- [ ] Adding "Pets" (expense) shows it under Expense; a duplicate name in the same kind shows "already exists" (CAT-1)
- [ ] Renaming and archiving work; archived categories stay attached to existing transactions (the database guarantees this; 1d will hide them from new-transaction pickers)
- [ ] System categories (Opening balance, Balance adjustment) never appear and can't be edited through the actions (CAT-1, SEC-1)
- [ ] Navigation shows Categories on desktop and under More on mobile

---

## Tests

| Test | File | Verifies |
| --- | --- | --- |
| set_opening_balance add/change/remove | `supabase/tests/07_opening_balance.test.sql` | One opening balance per account; balances; void on 0; audit; integrity |
| set_opening_balance access | `supabase/tests/07_opening_balance.test.sql` | Other user gets 42501; anon denied; archived rejected |
| DB error mapping | `src/lib/db-errors.test.ts` | Codes map to safe messages; raw text never returned |
| Liability sign handling | `src/lib/accounts.test.ts` | Credit card entered as owed ↔ stored negative; negative owed rejected |
| Navigation with Categories | `src/lib/navigation.test.ts` | Stage 1 list includes Categories; mobile More placement |
| Create accounts and per-currency totals | `e2e/accounts.spec.ts` | KRW and USD accounts; credit card owed; separate totals; bad amounts rejected |
| Opening balance edit | `e2e/accounts.spec.ts` | Change and remove opening balance; balance updates |
| Reconcile | `e2e/accounts.spec.ts` | Adjustment posted with the exact difference; "already matches" path |
| Archive account | `e2e/accounts.spec.ts` | Archived hidden by default; can't reconcile; unarchive restores |
| Foreign account 404 | `e2e/accounts.spec.ts` | User B opening A's account URL gets 404 |
| Categories CRUD | `e2e/categories.spec.ts` | Add, duplicate error, rename, archive and unarchive; system categories absent |
| Mobile layout | `e2e/accounts.spec.ts` (mobile project) | No horizontal scroll at 375px on list, account and reconcile pages |
