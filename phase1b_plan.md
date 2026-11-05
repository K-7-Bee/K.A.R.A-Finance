# Phase 1b: Auth and app shell

Stage 1 sub-phase 1b (see the Stage 1 split: 1a ledger foundation, done; **1b auth + shell**; 1c accounts + categories UI; 1d transactions + Overview).

**Sources.** There is no `implementation_plan.md`, `requirements.md`, `design.md` or `technology_decisions.md`. Requirements come from [CLAUDE.md](CLAUDE.md) (Security, Navigation, Design system), the product blueprint, and the 1a foundation already on `main`.

| ID | Requirement |
| --- | --- |
| AUTH-1 | Users can sign up, confirm their email, sign in and sign out with email and password |
| AUTH-2 | Users can reset a forgotten password |
| AUTH-3 | Every app page requires a session; signed-out visitors reach only the auth pages |
| SEC-1 | Users never reach another user's data (RLS from 1a; the app uses the user's session, never the service role) |
| SEC-2 | Secrets server-side only; only public Supabase values in the browser |
| SEC-3 | Sensitive actions protected: strong passwords, generic auth errors (no account enumeration), rate limits on |
| NAV-1 | Navigation per CLAUDE.md: sidebar on desktop, bottom bar on mobile |
| UX-1 | Light theme by default; KARA tokens; colour carries meaning; responsive with accessible contrast |
| FIN-3 | Money shown from integer minor units using the currency's minor unit, never float arithmetic |
| FIN-7 | Times shown in the workspace timezone |

**Already done in 1a (not re-planned):**
- the signup trigger creates the profile, personal workspace and default categories
- KARA colour tokens are in `globals.css`

**Decisions made in this plan** (flag if you disagree):
- **Email + password** sign-in, with email confirmation. Locally, confirmation emails land in Mailpit (`http://127.0.0.1:54324`). Magic links and 2FA wait for a later phase.
- **Navigation shows only sections that exist.** The full section list from CLAUDE.md lives in one config with a `stage` field, and later-stage items stay hidden until built. CLAUDE.md's mobile bar (Overview, Transactions, Goals, Analytics, More) is therefore **Overview, Transactions, Accounts, More** in Stage 1. Goals and Analytics replace Accounts in the bar when they ship, and Accounts moves under More.
- **No new validation library.** Form input is checked by small hand-written validators. The database already rejects bad data.

## Summary

| # | Task | Requirements |
| --- | --- | --- |
| 1 | Auth hardening in Supabase config | SEC-3, AUTH-1 |
| 2 | Supabase clients, env and route protection | AUTH-3, SEC-1, SEC-2 |
| 3 | Sign-up, sign-in, email confirmation and sign-out | AUTH-1, SEC-3 |
| 4 | Password reset | AUTH-2, SEC-3 |
| 5 | Formatting utilities and workspace loader | FIN-3, FIN-7, SEC-1 |
| 6 | App shell and navigation | NAV-1, UX-1 |
| 7 | Settings page | SEC-1, FIN-7 |
| 8 | End-to-end auth tests | AUTH-1–3, SEC-1 |

## Dependencies

- [x] 1a merged to `main`: schema, signup trigger, RLS
- [ ] Local Supabase running (`pnpm db:start`), with `.env.local` created from `.env.example` using the anon key printed by `db:start`
- [ ] **User approval to install** `@playwright/test` (dev) plus the Chromium browser download (`pnpm exec playwright install chromium`). This is needed for Task 8 and for execute-phase's UI check.

---

## Tasks

### Task 1: Auth hardening in Supabase config

**What:** Tighten local auth settings so they match what production will use.

**Files:**
- Modify: `supabase/config.toml`, under `[auth]` and `[auth.email]`:
  - `site_url = "http://localhost:3000"`
  - `additional_redirect_urls = ["http://localhost:3000/**", "http://127.0.0.1:3000/**"]`
  - `minimum_password_length = 10`
  - `password_requirements = "lower_upper_letters_digits"`
  - `enable_confirmations = true`
  - `secure_password_change = true`
- Create: `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`. Links use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...`, the server-side PKCE flow.
- Modify: `supabase/config.toml`, wiring both templates under `[auth.email.template.*]`.
- Modify: `CLAUDE.md`, noting Mailpit for local auth emails.

**AC:**
- [ ] A password shorter than 10 characters, or one missing a letter case or digit, is rejected by Supabase Auth (SEC-3)
- [ ] Sign-up sends a confirmation email to Mailpit, and the user can't sign in until they confirm (AUTH-1)
- [ ] Rate limits stay at Supabase defaults or stricter

---

### Task 2: Supabase clients, env and route protection

**What:** Server and browser Supabase clients using `@supabase/ssr`, plus middleware that refreshes the session and guards routes.

**Files:**
- Create: `src/lib/env.ts`
  - reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - throws a clear error if either is missing
  - no other Supabase key is read anywhere
- Create: `src/lib/supabase/server.ts`, providing `createClient()` for Server Components and Server Actions. It uses `cookies()` from `next/headers` with `getAll` and `setAll`.
- Create: `src/lib/supabase/client.ts`, providing `createClient()` for Client Components.
- Create: `src/lib/supabase/middleware.ts`, providing `updateSession(request)`:
  - refreshes the session via `supabase.auth.getUser()`
  - returns a response with refreshed cookies
- Create: `src/lib/routes.ts`, listing public paths: `/sign-in`, `/sign-up`, `/forgot-password`, `/auth/confirm`, `/auth/error`. Everything else is protected.
- Create: `src/middleware.ts`
  - signed-out visitors on a protected path are redirected to `/sign-in?next=<path>`
  - signed-in users on `/sign-in` or `/sign-up` are redirected to `/overview`
  - the matcher excludes static assets
- Create: `src/lib/safe-redirect.ts`, providing `safeNext(next)`. It allows only same-origin relative paths starting with a single `/`, otherwise falling back to `/overview`. This prevents open redirects.

**AC:**
- [ ] A signed-out `GET /overview` returns a redirect to `/sign-in?next=%2Foverview` (AUTH-3)
- [ ] Route decisions use `getUser()` (verified with Auth), never `getSession()` alone
- [ ] `safeNext` rejects `//evil.com`, `https://evil.com`, `/\evil.com` and `javascript:` (SEC-3)
- [ ] `git grep -n "SERVICE_ROLE\|service_role" src` returns nothing (SEC-1, SEC-2)

---

### Task 3: Sign-up, sign-in, email confirmation and sign-out

**What:** Auth pages backed by Server Actions.

**Files:**
- Create: `src/app/(auth)/layout.tsx`, a centred card layout with a Midnight brand header
- Create: `src/app/(auth)/sign-in/page.tsx`
- Create: `src/app/(auth)/sign-up/page.tsx`
- Create: `src/app/(auth)/actions.ts`, with Server Actions:
  - `signIn`
  - `signUp`, which shows a "check your email" state
  - `signOut`
- Create: `src/app/auth/confirm/route.ts`
  - `GET` with `token_hash` and `type` calls `verifyOtp`
  - then redirects to `safeNext(next)`, or to `/auth/error` on failure
- Create: `src/app/auth/error/page.tsx`
- Create: `src/lib/validation/auth.ts`, with `validateEmail` and `validatePassword` mirroring the Task 1 rules for instant feedback. Supabase remains the source of truth.

**AC:**
- [ ] Sign-up with valid details shows "check your email"; the confirmation link signs the user in and lands on `/overview` (AUTH-1)
- [ ] A wrong password and an unknown email produce the same message: "Email or password is incorrect" (SEC-3)
- [ ] Sign-up for an already registered email shows the same "check your email" state as a new sign-up (SEC-3)
- [ ] Sign-out clears the session and returns to `/sign-in`, and `/overview` then redirects (AUTH-1, AUTH-3)
- [ ] Forms work without client JavaScript (progressive enhancement via Server Actions); inputs have labels; errors use `aria-live`

---

### Task 4: Password reset

**What:** Forgot-password and set-new-password flow.

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`. The action calls `resetPasswordForEmail` with the redirect to `/auth/confirm?next=/reset-password`.
- Create: `src/app/(app)/reset-password/page.tsx`, a protected page. The recovery link creates the session, and the action calls `updateUser({ password })`.
- Modify: `src/app/(auth)/actions.ts`, adding `requestPasswordReset` and `updatePassword`.

**AC:**
- [ ] The forgot-password form always shows the same confirmation, whether or not the email exists (SEC-3)
- [ ] The recovery email link leads to the reset page; the new password must meet the Task 1 rules; afterwards the old password no longer works (AUTH-2)

---

### Task 5: Formatting utilities and workspace loader

**What:** Pure helpers for money and dates, plus a server helper that loads the signed-in user's personal workspace.

**Files:**
- Create: `src/lib/money.ts`
  - `formatMoney(minor: number, currency: string, minorUnit: number, locale?: string)`
    - formats with `Intl.NumberFormat` and the given fraction digits
    - converts minor units to a decimal string by integer division and remainder, never by float multiplication
  - `parseMoneyInput(text, minorUnit)`
    - parses user input like `"12,345"` or `"12.34"` to integer minor units
    - rejects more decimals than the currency allows
    - rejects non-numeric input
  - Both throw if the value isn't a safe integer.
- Create: `src/lib/dates.ts`, with `formatInTimeZone(iso, timeZone, options)` and `localMonthRange(timeZone, now)`. The latter returns `{from, to}` date strings for the current month in that timezone (used by 1d).
- Create: `src/lib/workspace.ts`, providing `getPersonalWorkspace()`:
  - runs server-side with the user's session
  - selects `id, name, base_currency, timezone` from `workspaces` where `kind = 'personal'`
  - redirects to `/sign-in` if there's no user
  - throws if the workspace is missing, which shouldn't happen given the signup trigger
- Create: `src/lib/money.test.ts`, `src/lib/dates.test.ts` and `src/lib/safe-redirect.test.ts`

**AC:**
- [ ] `formatMoney(1234567, 'KRW', 0)` → `₩1,234,567`; `formatMoney(-150, 'USD', 2)` → `-$1.50` (FIN-3)
- [ ] `parseMoneyInput('12.345', 2)` is rejected; `parseMoneyInput('1,000', 0)` → `1000`; `'abc'` is rejected (FIN-3)
- [ ] `formatInTimeZone('2026-10-31T15:30:00Z', 'Asia/Seoul')` shows 1 Nov (FIN-7)
- [ ] `getPersonalWorkspace` uses only the user-session client (SEC-1)

---

### Task 6: App shell and navigation

**What:** The signed-in layout, with a sidebar on desktop and a bottom bar plus a More sheet on mobile.

**Files:**
- Create: `src/lib/navigation.ts`
  - the full CLAUDE.md section list: Overview, Transactions, Accounts, Budgets, Goals, Analytics, AI Assistant, Business, Settings
  - fields per section: `href`, `label`, `stage`, `mobile: 'bar' | 'more'`
  - `visibleNav(currentStage)` returns only built sections. Stage 1 shows Overview, Transactions, Accounts and Settings.
- Create: `src/app/(app)/layout.tsx`
  - loads the workspace with `getPersonalWorkspace()`
  - desktop: Midnight sidebar showing the workspace name and the user's email, plus a sign-out button
  - mobile: fixed bottom bar
- Create: `src/components/nav/sidebar.tsx`, `src/components/nav/bottom-bar.tsx` and `src/components/nav/more-menu.tsx`. The More menu uses a native `<details>` or a dialog with focus handling. The active link gets `aria-current="page"`.
- Create placeholder pages, each a heading plus a one-line empty state saying which phase fills it:
  - `src/app/(app)/overview/page.tsx`
  - `src/app/(app)/transactions/page.tsx`
  - `src/app/(app)/accounts/page.tsx`
- Modify: `src/app/page.tsx`, redirecting `/` to `/overview` (middleware sends signed-out users to sign-in)
- Create: `src/lib/navigation.test.ts`

**AC:**
- [ ] At ≥ 1024px the sidebar shows the Stage 1 sections; at 375px the bottom bar shows Overview, Transactions, Accounts and More, and More contains Settings (NAV-1)
- [ ] No section from a later stage is visible or reachable from navigation (CLAUDE.md "do not build later-stage features")
- [ ] No horizontal scroll at 375px; text and nav colours meet WCAG AA contrast on Cloud and Midnight backgrounds (UX-1)
- [ ] Keyboard navigation reaches every nav item, with visible focus rings

---

### Task 7: Settings page

**What:** Profile and workspace preferences. These are the first app writes, and they go through RLS-protected updates.

**Files:**
- Create: `src/app/(app)/settings/page.tsx`
  - display name (on `profiles`)
  - workspace name and timezone (on `workspaces`); the timezone is a `<select>` of IANA zones from `Intl.supportedValuesOf('timeZone')`, defaulting to `Asia/Seoul`
  - read-only base currency (KRW)
  - "Change password" link to `/reset-password`
- Create: `src/app/(app)/settings/actions.ts`
  - `updateProfile` and `updateWorkspace` Server Actions using the user-session client
  - surfaces the database's `unknown timezone` error as a field error

**AC:**
- [ ] Saving updates the row and shows a success message; the change appears in `audit_log` with the user as actor (SEC-3)
- [ ] An invalid timezone posted directly to the action is rejected by the database and shown as a field error (FIN-7)
- [ ] The actions never take a workspace id from the form. They use `getPersonalWorkspace()`, so a tampered form can't target another workspace (SEC-1).

---

### Task 8: End-to-end auth tests

**What:** Playwright tests driving the real app against local Supabase, using Mailpit's API to read confirmation emails.

**Files:**
- Create: `playwright.config.ts`
  - `webServer` runs `pnpm dev` on port 3000
  - Chromium only
  - two viewports: desktop and a 375px-wide mobile
- Create: `e2e/helpers/mailpit.ts`, providing `latestLinkFor(email)`. It reads `http://127.0.0.1:54324/api/v1` and extracts the confirm link.
- Create: `e2e/auth.spec.ts`
- Create: `e2e/navigation.spec.ts`
- Modify: `package.json`, adding `"test:e2e": "playwright test"`
- Modify: `.gitignore`, ignoring `test-results/`, `playwright-report/` and `playwright/.auth/`
- Modify: `CLAUDE.md`, adding `pnpm test:e2e` to Commands

**AC:**
- [ ] `pnpm test:e2e` passes from a clean `pnpm db:reset`
- [ ] Every AC marked AUTH-* or NAV-1 above is covered by at least one E2E test

---

## Tests

| Test | File | Verifies |
| --- | --- | --- |
| safeNext rejects open redirects | `src/lib/safe-redirect.test.ts` | Task 2 open-redirect AC |
| Money formatting and parsing | `src/lib/money.test.ts` | Integer minor units, currency digits, bad input rejected |
| Timezone formatting and month range | `src/lib/dates.test.ts` | KST month boundaries |
| Auth validators | `src/lib/validation/auth.test.ts` | Password rules match Supabase config |
| Stage-aware navigation | `src/lib/navigation.test.ts` | Only Stage 1 sections visible; mobile bar and More split |
| Signed-out redirect | `e2e/auth.spec.ts` | `/overview` → `/sign-in?next=/overview` |
| Sign-up → confirm → overview | `e2e/auth.spec.ts` | Mailpit confirmation link signs the user in |
| Generic sign-in error | `e2e/auth.spec.ts` | Same message for wrong password and unknown email |
| Sign-out | `e2e/auth.spec.ts` | Session cleared; protected pages redirect |
| Password reset | `e2e/auth.spec.ts` | Recovery link → new password works, old one doesn't |
| Two users isolated | `e2e/auth.spec.ts` | User B's Settings shows B's workspace, never A's |
| Desktop and mobile nav | `e2e/navigation.spec.ts` | Sidebar at 1280px; bottom bar + More at 375px; no horizontal scroll |
| Settings saves | `e2e/navigation.spec.ts` | Display name and timezone persist after reload |
