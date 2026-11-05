# AI Governance Guide

This guide sets where KARA Finance may use AI and where it must use deterministic code. It applies the "AI boundaries" section of [CLAUDE.md](../CLAUDE.md) to each feature in the product blueprint.

Status: this is design guidance. No AI features exist yet. They start in Stage 3.

## Classifications

| Classification | Meaning | Requirement |
| --- | --- | --- |
| **DETERMINISTIC** | Code runs it and gives the same result every time. No AI is involved. | Unit, integration and E2E tests |
| **AI-ADVISORY** | AI writes output that a person reads before acting on it. | No AI-originated numbers. Post-check required (see below). |
| **AI-OPERATIONAL** | The system acts on AI output, or stores it, without full review. | Schema enforcement, a deterministic validator, and an audit row |

The five layers referenced below are:

1. Orchestration
2. Action gating
3. Output schema
4. Content correctness
5. Post-execution audit

## Classification map

| # | Feature | Stage | Classification | AI does | Code does | Risk if wrong |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Ledger posting, balances, transfers, totals | 1 | DETERMINISTIC | Nothing | Everything | — |
| 2 | Budget spend and threshold alerts | 2 | DETERMINISTIC | Nothing | Sums, % thresholds, alert triggers | — |
| 3 | Goal required contribution | 2 | DETERMINISTIC | Nothing | Date math, division | — |
| 4 | Gamification (XP, streaks, milestones) | 2+ | DETERMINISTIC | Nothing | Rule evaluation | — |
| 5 | Financial health score | 3 | DETERMINISTIC | May explain the score | Formula, weights, sub-scores | High: unsourced weights |
| 6 | Unusual spending detection | 3 | DETERMINISTIC detection + AI-ADVISORY explanation | Explains why a flagged item looks unusual | Statistical flag (per-category z-score / IQR) | Medium |
| 7 | Forecasting | 3 | DETERMINISTIC model + AI-ADVISORY narrative | Explains assumptions in plain language | Projection, uncertainty band, assumptions list | High if an LLM produces the numbers |
| 8 | What-if simulator | 3 | AI-OPERATIONAL (input parsing) + DETERMINISTIC engine | Turns a natural-language scenario into structured parameters | Validates parameters, runs the simulation | Medium |
| 9 | Budget suggestions | 2/3 | DETERMINISTIC proposal + AI-ADVISORY wording | Narrates the suggestion | Median of last N months per category; user approves | Low |
| 10 | AI assistant Q&A | 3 | AI-ADVISORY | Synthesis, explanation | All numbers, via read-only tools | High: invented or miscalculated figures |
| 11 | Weekly AI insights on Overview | 3 | AI-ADVISORY | Writes the insight text | Supplies every number in it | High: Overview must match the ledger |
| 12 | Receipt extraction → draft | 4 | AI-OPERATIONAL (draft), AI-ADVISORY (posting) | Extracts merchant, date, total, line items | Schema, sanity checks, posting after confirmation | High: users tend to approve drafts without reading |
| 13 | Assistant-proposed actions | 3 | AI-OPERATIONAL, gated | Proposes a structured action | Validates it, shows the diff, executes after confirmation | High |
| 14 | Auto-categorization | 6 | AI-OPERATIONAL | Suggests or assigns a category | User rules first, validator, audit | High: silently shifts budget totals and alerts |

## Rules by component

### Deterministic only (features 1–5)

- Anything that is arithmetic, date math or rule evaluation is code, with unit tests.
- **Health score.** Store the weights in a versioned config. Give each weight a `rationale` or `verified_against` note, and show users the breakdown. A score that is consistently wrong still looks trustworthy, which makes it the most dangerous kind of error.

### Forecasting and budget suggestions (features 7 and 9)

- An LLM never produces forecast or budget numbers.
- Code computes the projection, the uncertainty band and the list of assumptions.
- The AI only explains the assumptions that code passes to it. This meets the CLAUDE.md rule that forecasts must disclose their assumptions.

### Assistant Q&A and weekly insights (features 10 and 11)

- **Layer 4.**
  - The model gets only read-only tools that return pre-computed figures, such as `get_category_totals(range)` and `get_account_balances(as_of)`.
  - The model is never asked to add, average or compare numbers itself.
  - If it needs a figure that no tool provides, it says so.
- **Layer 5.**
  - After the model responds, extract every money figure and date from the text. Each one must match a value the tools returned. If one doesn't, regenerate the response or remove the figure.
  - Stored insights use template slots: the LLM writes `{{food_delta_pct}}` and code fills in the value.
  - Store each insight with a `data_as_of` timestamp.
  - AI text never appears in the KPI cards.
- **Scoping.**
  - Tools run with the user's JWT, so row-level security applies. They never use the service role.
  - `workspace_id` comes from the session, never from model arguments. Personal and business data must never silently mix.
- **Prompt injection.** Merchant names, notes and OCR text are untrusted input. Because the tools are read-only, an injected instruction can at worst produce bad text, never a bad write.

### Receipt extraction (feature 12)

- **Layer 3.** Use structured output with a strict schema:
  - `merchant: string`
  - `date: ISO date`
  - `total_minor: integer`
  - `currency: enum`
  - `line_items[]`

  Reject output that doesn't parse. Never fall back to regex.
- **Layer 2.** Run deterministic sanity checks:
  - Line items sum to the total. If they don't, flag the draft.
  - The date is not in the future or implausibly old.
  - The currency is supported.
  - The amount is greater than 0.
- **Draft storage.**
  - Drafts live in `receipt_drafts` and never touch `ledger_entries`.
  - The confirm screen highlights flagged fields.
- **Layer 5.** Store:
  - the raw model output
  - the model name and version
  - the difference between the AI draft and the confirmed transaction (this is the accuracy metric)

### Assistant actions (feature 13)

Every write follows this path:

```
LLM → ProposedAction (schema)
    → validator (workspace ownership, account exists, integer amount,
                 category type matches transaction type)
    → confirmation UI showing the exact effect
    → the same posting service used by manual entry
    → audit row (source='assistant', confirmed_by=user_id, idempotency_key)
```

The model never has a tool that writes directly.

### Auto-categorization (feature 14)

- User-defined merchant → category rules run first. AI handles only what's left.
- **Validator.**
  - The category exists in this workspace.
  - The category type matches the transaction (expense or income).
  - Categorization never changes an amount or an account.
- Rows get `categorized_by='ai'`. The change is reversible in one click and is written to the audit log.
- Affected budgets are recomputed through the normal deterministic path.

### What-if simulator (feature 8)

Parsed parameters are always shown to the user as editable fields before the engine runs.

## Data sent to the AI provider

Sending ledger data to OpenAI counts as a financial-data integration, so it requires explicit consent.

- Send only the data needed. Never send account numbers.
- Use the provider's zero or limited data-retention settings where available.
- Keep API keys server-side only.

## Stage 1 foundations

None of the AI features belong in Stage 1. These four Stage 1 decisions are what make governing them possible later:

1. [ ] **Single posting service.** One server-side function (a Postgres RPC inside a DB transaction) creates balanced ledger entries. Later, manual entry, CSV import, receipt confirmation and assistant actions all go through it.
2. [ ] **`source` field and audit log from day one.**
   - Transactions carry `source` (`manual | import | receipt | assistant | rule`) and `created_by`.
   - An append-only audit table stores before and after snapshots.
3. [ ] **Aggregates as reusable SQL functions or views.** These cover category totals, balances as of a date, and monthly income and expense excluding transfers. The dashboard uses them now, and in Stage 3 they become the assistant's read-only tools. AI-quoted numbers and dashboard numbers then come from the same code.
4. [ ] **Row-level security tests.**
   - User A cannot read user B's data.
   - Personal-workspace queries cannot see business-workspace rows.

   AI tools will inherit both.
5. [ ] *(Stage 3)* Build the Layer 5 number check on responses before the assistant ships, not afterwards.
