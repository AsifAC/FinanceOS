# Production frontend release

Release review date: 2026-10-02. The accumulated Phase 1–8 work is preserved.
No temporary/debug or unrelated file was identified for removal.

## Production targeting

The existing Vercel project is `finance-os` in `asifacs-projects`, serving
`https://www.financeos.com`. Its Git integration uses `AsifAC/FinanceOS`, branch
`main`, with Vite's `npm run build` and `dist` output. `vercel.json` provides the
SPA rewrite required for direct authenticated URLs and refreshes.

Production frontend configuration contains only the live Supabase URL and
publishable key, plus the existing verification-readiness flags. Verification
enforcement and email/phone delivery remain disabled pending a separately
approved provider-readiness check. Never publish service-role keys. `.env.local`,
`.vercel`, build output, and local Supabase runtime state remain ignored.

**This checkout is linked to LIVE Supabase `zmbyqstmgtdbyvczuvki`.** Do not run
bare `supabase db push`, remote resets, migration commands, or SQL mutations
as part of a frontend release. Future migrations require review, explicit local
validation, and separate deployment authorization. Database tests must use
`--local` explicitly. No live schema or financial data changes accompany this
frontend release.

## Source-of-truth contract

| Data | Authoritative source |
| --- | --- |
| Actual financial events, all user-facing actual totals/charts | Supabase `transactions` |
| Single dated planned events and lifecycle | Supabase `expected_transactions` |
| Categories and payment methods | Owner-backed Supabase UUIDs |
| Account snapshots and archives | Supabase `budget_snapshots`, stored JSONB |
| Monthly budget targets | Local planning state |
| Fixed/pending plans, payment plans, savings targets, planning period | Local planning state |
| Legacy local actual rows | Preserved compatibility data, excluded from actual screens |
| Legacy local archives | Separate labeled read-only local section |

Dashboard, Reports, Annual Planner, Income, Expenses, and Savings reuse shared
account actual totals and calendar-date helpers. Debt actuals use the ledger
and shared totals; the Debt navigation entry remains the local Payment Plans
screen. No local actual or planning rows are merged, uploaded, or auto-imported.
Legacy archive records remain stored-value based and are not rewritten.

Expected completion uses one atomic RPC. It locks the planned row, checks
ownership, creates one actual UUID, links it, and retains the completed expected
event as history. Retries and overlapping requests reuse the linked actual.
Completed rows are read-only; linked actual deletion is restricted. Browser
clients cannot directly write the completion link/timestamp.

## Focused stabilization changes

- Preserve independent same-period snapshot versions after a re-save.
- Discard stale archive feedback and prevent duplicate snapshot submissions.
- Bind category/payment mutations to the account captured before Auth lookup;
  reject stale results, including default-method RPC feedback.
- Reset screen-local editors/selection on account change while preserving local
  planning state.
- Correct the workspace source disclosure and local monthly-target heading.
- Add Annual Planner navigation, retain all requested routes, and make the
  menu scrollable on short screens.
- Configure existing production browser-safe environment variables and repair
  direct-route hosting without changing the database.

## Validation and smoke checks

```sh
npm run typecheck
npm run build
git diff --check
node --test tests/*.test.mjs
# With npm run dev running:
node tests/transactionsBrowser.mjs
node tests/authBrowser.mjs
# Existing local Docker Supabase only:
supabase test db --local
node tests/expectedCompletionConcurrency.mjs
```

The release passed 87 Node tests and 169 pgTAP assertions (27 snapshots,
88 expected events, 54 completion), plus both mocked browser suites and the
overlapping-completion integration test. Responsive coverage includes
375/768/1024/1440 widths. Browser tests verify owner switching, stale reads and
mutations, source separation, actual CRUD, expected lifecycle/completion, and
unchanged local finance/setup storage. No production test account is needed.

`node tests/productionSmoke.mjs` checks public production pages, deep-link
authentication guards, responsive layout, and runtime/HTTP errors. It uses a
fresh isolated Chrome profile and blocks financial write requests. Add
`--interactive` only when the owner can sign in with an existing account for
read-only authenticated route checks. Credentials and financial values are not
logged. Never create disposable financial records to smoke-test production
completion; rely on the local behavioral and concurrency suites.

The main production JS chunk is approximately 1.38 MB (383 kB gzip); CSS is
195 kB (34 kB gzip). The existing Vite size warning is advisory. No accidental
large asset import was found. Route-level lazy loading and chart/PDF splitting
are follow-up work, not changes to this release.

## Migration audit

All nine ordered repository migration versions match production history:

1. `20260902210238` — profiles/preferences
2. `20260902211646` — categories
3. `20260902212850` — payment methods
4. `20260909161607` — actual transactions
5. `20260926210523` — verification
6. `20261001012942` — account snapshots
7. `20261001032754` — expected events
8. `20261001040248` — completion-field hardening
9. `20261002184257` — atomic completion RPC

Release inspection reconfirmed owner RLS for all financial tables, safe expected
column privileges, authenticated-only RPC execution, empty function search
paths, the private definer/public invoker boundary, and owner-safe unique actual
linkage with deletion restriction. No migration file was edited or reapplied.

## Commit and follow-up plan

The database contracts/tests, integrated application/tests, and documentation/
hosting configuration are grouped into three understandable commits. Actual,
expected, archive, and auth/UI application files are intertwined and remain one
cohesive application commit. No Git history is rewritten.

Recurrence, undo completion, planning imports, and account-backed monthly
targets remain deferred. Provider verification readiness and leaked-password
protection need a separate Auth-settings review. Local planning remains shared
within the browser, as disclosed in the UI. Authenticated production reads
require the existing account owner's sign-in; completion is not exercised by
creating production test records.

## Reviewed worktree inventory

Every accumulated changed/new file is classified below. Runtime environment,
Docker, and Vercel files are ignored and excluded from these commits.

### Required release/local-test configuration

- `.gitignore`
- `supabase/.gitignore`
- `supabase/config.toml`
- `vercel.json`

### Documentation

- `README.md`
- `docs/ci.md`
- `docs/release.md`
- `docs/snapshots.md`
- `docs/supabase-backend-plan.md`

### Required product/auth/branding/UI

- `src/app/components/archive/SaveSnapshotActions.tsx`
- `src/app/components/auth/AuthForm.tsx`
- `src/app/components/charts/ElevatedExpenseDonutChart.tsx`
- `src/app/components/layout/ActualTransactionsLayout.tsx`
- `src/app/components/layout/AppShell.tsx`
- `src/app/components/layout/MenuDropdown.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/screens/AddTransaction.tsx`
- `src/app/components/screens/AnnualPlanner.tsx`
- `src/app/components/screens/Categories.tsx`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/screens/ExpectedTransactions.tsx`
- `src/app/components/screens/ExpenseTracker.tsx`
- `src/app/components/screens/IncomeTracker.tsx`
- `src/app/components/screens/PaymentMethodManagement.tsx`
- `src/app/components/screens/PaymentMethods.tsx`
- `src/app/components/screens/Reports.tsx`
- `src/app/components/screens/SavedBudgets.tsx`
- `src/app/components/screens/Settings.tsx`
- `src/app/components/screens/TrackerUI.tsx`
- `src/app/components/screens/Transactions.tsx`
- `src/app/components/screens/VerifyAccount.tsx`
- `src/app/lib/actualTransactionCategories.ts`
- `src/app/lib/actualTransactionDrafts.ts`
- `src/app/lib/actualTransactionTotals.ts`
- `src/app/lib/categoryLabels.ts`
- `src/app/lib/expectedTransactionDrafts.ts`
- `src/app/lib/expectedTransactionPresentation.ts`
- `src/app/lib/financeStore.tsx`
- `src/app/lib/paymentMethodLabels.ts`
- `src/app/lib/selectableCategories.ts`
- `src/app/lib/selectablePaymentMethods.ts`
- `src/app/lib/snapshotActuals.ts`
- `src/app/lib/transactionDates.ts`
- `src/app/routes.ts`
- `src/hooks/useCategories.ts`
- `src/hooks/useExpectedTransactions.ts`
- `src/hooks/usePaymentMethods.ts`
- `src/hooks/useSnapshotActualData.ts`
- `src/hooks/useSnapshots.ts`
- `src/hooks/useTransactions.ts`
- `src/lib/supabaseClient.ts`
- `src/services/categoryService.ts`
- `src/services/expectedTransactionService.ts`
- `src/services/paymentMethodService.ts`
- `src/services/snapshotService.ts`
- `src/services/transactionService.ts`
- `src/styles/categories.css`
- `src/styles/dashboard-header.css`
- `src/styles/transactions.css`
- `src/types/supabase.ts`

### Required migrations

- `supabase/migrations/20261001012942_budget_snapshots.sql`
- `supabase/migrations/20261001032754_expected_transactions.sql`
- `supabase/migrations/20261001040248_harden_expected_transaction_completion_fields.sql`
- `supabase/migrations/20261002184257_complete_expected_transaction.sql`

### Required tests

- `supabase/tests/budget_snapshots.test.sql`
- `supabase/tests/expected_transaction_completion.test.sql`
- `supabase/tests/expected_transactions.test.sql`
- `tests/actualTransactionCategories.test.mjs`
- `tests/actualTransactionDrafts.test.mjs`
- `tests/actualTransactionTotals.test.mjs`
- `tests/authBrowser.mjs`
- `tests/categoryLabels.test.mjs`
- `tests/expectedCompletionConcurrency.mjs`
- `tests/expectedTransactionDrafts.test.mjs`
- `tests/expectedTransactionPresentation.test.mjs`
- `tests/expectedTransactionService.test.mjs`
- `tests/metadataOwnership.test.mjs`
- `tests/paymentMethodLabels.test.mjs`
- `tests/productionSmoke.mjs`
- `tests/selectableCategories.test.mjs`
- `tests/selectablePaymentMethods.test.mjs`
- `tests/snapshotActuals.test.mjs`
- `tests/snapshotMigration.test.mjs`
- `tests/snapshotService.test.mjs`
- `tests/transactionDates.test.mjs`
- `tests/transactionService.test.mjs`
- `tests/transactionsBrowser.mjs`
