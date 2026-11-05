# KARA Finance

A personal finance web app, with mobile and a separate business workspace to follow. It should help users see what they have, where their money goes, what they can safely spend, and how they are progressing toward their goals.

**Current focus: Stage 1 and the MVP below.** Do not build later-stage features unless asked.

## Tech stack

| Layer | Technology |
| --- | --- |
| Web | Next.js + React |
| Mobile (later) | React Native + Expo |
| Styling | Tailwind CSS with shared design tokens |
| Charts | Recharts |
| Backend | Supabase |
| Database | PostgreSQL |
| Auth | Supabase Auth |
| File storage | Supabase Storage (receipts, exports) |
| AI (later) | OpenAI API |
| Hosting | Vercel |
| Version control | GitHub |

Build the web app first. Keep domain logic and financial calculations in a shared backend so that mobile can reuse the same rules and data.

## Commands

Local development needs Docker running (for the local Supabase stack).

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | App unit tests (Vitest) |
| `pnpm db:start` / `pnpm db:stop` | Start or stop local Supabase |
| `pnpm db:reset` | Recreate the local database and apply every migration |
| `pnpm db:test` | Database tests (pgTAP, `supabase/tests/`) |
| `pnpm db:new <name>` | Create a new migration file |

Copy `.env.example` to `.env.local` and fill in the local values printed by `pnpm db:start`.

## Ledger architecture

- `transactions` and `ledger_entries` are written **only** by the posting functions in `supabase/migrations/*_posting_service.sql`: `post_transaction`, `update_transaction`, `void_transaction`, `create_account` and `reconcile_account`. RLS gives users read-only access to both tables.
- A deferred constraint trigger checks every posted transaction at commit: exactly two entries, summing to zero, in the transaction's currency, and shaped to match its type.
- Totals come only from the aggregate SQL functions: `account_balances`, `period_totals`, `category_totals` and `ledger_integrity_check`. They run as the caller, so RLS applies.
- See [docs/ai-governance.md](docs/ai-governance.md) for the rules on where AI may and may not be used.

## Non-negotiable financial rules

- Use a double-entry ledger. Every posted transaction must balance.
- A transfer between a user's own accounts changes both balances, but is never income or an expense.
- Store money as integer minor units or fixed-precision decimals, never binary floating point.
- Store the currency on every relevant account and transaction. KRW is the default.
- Wrap related ledger postings in a database transaction so they succeed or fail together.
- Keep an audit trail for corrections and important financial changes.
- Store timestamps consistently and display them in the user's local timezone.
- Dashboard totals must match the underlying ledger for the selected date range.
- A savings goal linked to an account must not double-count that account's money.
- Personal and business workspaces have separate ledgers, permissions, and reports, and must never silently mix.

## AI boundaries

- Deterministic application code computes and records all balances, transfers, totals, and ledger updates. AI never does.
- AI explains and suggests, using only authorized, up-to-date app records. It must not invent financial facts.
- Forecasts must disclose their assumptions and uncertainty.
- Changing records or taking any sensitive action requires explicit user confirmation.
- Receipt extraction produces a draft transaction for the user to confirm.

## Security and privacy

- Enforce row-level security and least-privilege access. Users must never be able to reach another user's data.
- Keep secrets and API keys server-side, and never commit them.
- Never store bank passwords, card PINs, or card security codes.
- Encrypt data in transit and at rest.
- Protect and log sensitive actions.
- Require explicit consent for financial-data integrations.
- Do not claim tax or accounting compliance. It is a separate product and legal workstream.

## Roadmap

| Stage | Scope |
| --- | --- |
| 1. Core finance (build first) | Authentication, personal dashboard, accounts, income and expense tracking, categories, transaction history |
| 2. Planning | Budgets, savings goals, recurring bills, financial calendar, notifications |
| 3. Intelligence (once core data is reliable) | Analytics, reports, AI assistant, forecasting, what-if simulator |
| 4. Mobile (after web MVP) | Mobile dashboard, receipt capture, push notifications, biometric sign-in, sync |
| 5. Business | Business workspaces, revenue, expenses, cash flow, invoices, reports |
| 6. Automation | Authorized bank integrations, categorization, advanced monitoring and forecasting |

**MVP:** a web app with authentication, personal accounts, transaction entry, category management, an overview dashboard, budgets, and savings goals. It must work well with manual entry alone, with no bank connection or AI automation.

## Definition of done

| Module | Done when |
| --- | --- |
| Accounts | Users can create accounts, set opening balances, and reconcile balances |
| Transactions | Users can add, edit, and search income, expense, and transfer records |
| Ledger | Every posted transaction balances, and transfers do not inflate income or expense totals |
| Dashboard | Balances and monthly totals match the ledger for the selected date range |
| Budgets | Spending totals update correctly, and alerts trigger at configured thresholds |
| Goals | Contributions and progress are visible without double-counting account balances |
| Security | Users cannot access another user's data, and sensitive actions are protected and logged |

## Data model

Core entities:

- **Identity and workspaces:** `users`, `workspaces`
- **Money:** `accounts`, `transactions`, `ledger_entries`, `categories`
- **Planning:** `budgets`, `goals`, `recurring_rules`
- **Net worth:** `assets`, `liabilities`
- **Supporting:** `receipts`, `notifications`
- **Business:** `businesses`, `invoices`, `customers`, `vendors`

`transactions` are the user-facing records. `ledger_entries` hold the debit and credit postings behind them.

## Navigation

Main sections: Overview, Transactions, Accounts, Budgets, Goals, Analytics, AI Assistant, Business, Settings.

The mobile bottom bar shows Overview, Transactions, Goals, Analytics, and More. Everything else goes under More.

## Design system

| Token | Hex | Meaning |
| --- | --- | --- |
| Midnight | `#17243D` | Primary foundation, navigation |
| Violet | `#7657F6` | AI features, highlights |
| Mint | `#35C7A0` | Income, savings, positive cash flow |
| Blue | `#3998F5` | Accounts, information |
| Amber | `#FFB84D` | Goals, reminders, achievements |
| Coral | `#F16F91` | Expenses, losses, warnings |
| Cloud | `#F3F5FA` | Light surfaces, backgrounds |

- Default to a light dashboard, with optional dark mode.
- Use color to communicate meaning, not as decoration.
- Use consistent spacing, rounded cards, and readable typography.
- Keep key balance and monthly cash-flow figures near the top. The Overview should answer the main questions within five seconds.
- Use charts only when they clarify a decision.
- Keep key actions, such as Add transaction, easy to reach on desktop and mobile.
- Keep layouts responsive, with accessible contrast.

## Gamification

Reward useful habits, such as consistent tracking, staying within budget, reaching savings milestones, and completing monthly reviews. Never reward spending or simply opening the app. Streaks must not penalize a missed day.

## Localization

Use KRW by default, with optional multi-currency support. Korean and English labels are optional. Korean Open Banking and data-provider availability still needs investigating, and approval requirements vary.

## Working in this repo

- Build in layers, and finish the current stage before expanding.
- Prioritize accuracy over decoration: financial totals must be trustworthy.
- Add tests for ledger logic, transfers, balances, and access control alongside the code they cover.
- Make small, focused changes, and explain them in plain language, including why and how to verify them.
- Flag any request that conflicts with the rules in this file instead of quietly working around them.
