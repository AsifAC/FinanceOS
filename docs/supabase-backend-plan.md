# FinanceOS Supabase Backend Plan

## Project

- Supabase URL: https://zmbyqstmgtdbyvczuvki.supabase.co
- Backend rebuild status: transactions schema staged locally; payment_methods migration applied live
- Clean checkpoint: `e435950 chore: reset Supabase backend foundation`

## Current Status

- Public tables: profiles, user_preferences, categories, and payment_methods exist live
- Public RLS policies: profiles, user_preferences, categories, and payment_methods ownership policies exist live
- Storage buckets: not created yet
- Edge functions: not created yet
- Public database functions/triggers: profile/preferences timestamp, new-user bootstrap, default category bootstrap, payment_methods timestamp trigger, and atomic payment method default RPC exist live
- Frontend screens remain on the existing local/mock data path
- Supabase Auth service/provider exists locally and is not used for finance data yet
- Categories schema/service/hooks exist locally and are not connected to UI pages yet
- Payment methods schema/service/hooks exist locally and are not connected to UI pages yet
- Step 7 actual transactions migration/types/service/hook are complete locally, unapplied and disconnected from UI pages

## Integration Order

1. Auth
2. Profiles
3. User preferences
4. Categories
5. Payment methods
6. Transactions
7. Expected transactions
8. Savings goals
9. Debts
10. Dashboard calculations
11. Reports
12. Budget snapshots
13. Archived budgets
14. PDF exports/storage
15. Notifications

## Planned Tables

Tables are planned or staged but not connected to frontend finance workflows yet:

- profiles: live
- user_preferences: live
- categories: live
- payment_methods: live
- transactions: local migration staged, not applied live
- expected_transactions
- savings_goals
- debts
- budget_snapshots
- archived_budgets
- notifications

## Planned Storage Buckets

Storage buckets are planned but not created yet:

- pdf-exports
- user-imports

## RLS Pattern

- Every user-owned table must enable RLS before frontend integration.
- Policies should scope row access to `auth.uid()` and the owning user column.
- Reads, inserts, updates, and deletes should be explicit per table and per workflow.
- Public unauthenticated access should not be added unless a specific product requirement is approved.

## Safety Rules

- Never use or request the Supabase service role key for frontend work.
- Never place `service_role` keys in Vite env files, browser code, commits, docs examples, or screenshots.
- Use only frontend-safe variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `.env.local` should remain gitignored and machine-specific.

## Preview Mode Separation

- Mock/preview mode must remain separate from real Supabase data.
- Preview mode state must not write to live Supabase tables or storage.
- Real Supabase reads/writes should be introduced one workflow at a time after its schema, RLS policies, tests, and rollback path are documented.

## Step 3 Auth Foundation

Status:

- `src/services/authService.ts` wraps Supabase Auth calls with typed, sanitized results.
- `src/providers/AuthProvider.tsx` restores the current session, subscribes to auth state changes, and exposes auth actions through context.
- `src/hooks/useAuth.ts` provides the auth context hook.
- `src/app/components/auth/RequireAuth.tsx` is available for future protected routes but is not wired into current finance routes yet.
- `src/app/components/auth/AuthPanel.tsx` is a simple testing-only sign-in/sign-up panel and is not connected to routing yet.
- The existing profile menu sign-out action now calls Supabase Auth sign-out when configured and still clears only placeholder FinanceOS session keys.

Guest/mock behavior:

- Landing page remains public.
- Main app routes are not globally locked behind Supabase Auth yet.
- Missing local Supabase env vars leave the app usable in guest/mock mode.
- Auth state does not overwrite localStorage finance data or preview reducer state.

Not created yet:

- Profiles table
- User preferences table
- Finance tables
- RLS policies
- Storage buckets
- Database triggers/functions

Next planned step:

- Create the profiles and user_preferences schema plan, then add migrations and RLS only after the ownership model is finalized.

## Step 4 Profiles And User Preferences Schema

Status:

- Migration file: `supabase/migrations/20260902210238_create_profiles_and_user_preferences.sql`
- Migration has been applied to the live Supabase project.
- `public.profiles` is planned as the one-to-one profile record for `auth.users.id`.
- `public.user_preferences` is planned as a one-to-one preferences record through `user_id`.
- Local TypeScript table types were added for profiles and user_preferences only.
- `src/services/profileService.ts` and `src/hooks/useProfile.ts` provide minimal current-user profile fetch/update helpers.
- `src/services/userPreferencesService.ts` and `src/hooks/useUserPreferences.ts` provide minimal current-user preferences fetch/update helpers.

RLS ownership model:

- `profiles`: `auth.uid()` must equal `profiles.id`.
- `user_preferences`: `auth.uid()` must equal `user_preferences.user_id`.
- Authenticated users can select and update only their own rows.
- No public insert policy is defined for either table.
- Bootstrap row creation is handled by the auth user trigger.

New user bootstrap behavior:

- `public.handle_new_user()` runs after an auth user is inserted.
- It inserts a profile row using `new.id`, `new.email`, and safe metadata fallbacks for `full_name`, `display_name`, and `avatar_url`.
- It inserts a user_preferences row using `new.id` as `user_id`.
- The function uses `security definer` with an explicit empty search path and schema-qualified table references.
- Direct execute privileges are revoked from `public`, `anon`, and `authenticated`.

Not created yet:

- Finance tables
- Categories table
- Payment methods table
- Transactions table
- Expected transactions table
- Savings or debt tables
- Storage buckets
- Finance storage policies
- Finance data services wired to app pages

## Step 4B Apply And Verify Profiles And Preferences

Live apply status:

- Applied live through Supabase MCP as `20260902210238_create_profiles_and_user_preferences`.
- The local migration filename was aligned to the live migration version after apply to avoid migration history drift.
- Verified `public.profiles` and `public.user_preferences` exist.
- Verified RLS is enabled on both tables.
- Verified expected select/update ownership policies exist on both tables.
- Verified `public.set_updated_at()` and `public.handle_new_user()` exist.
- Verified `auth.users` has the `on_auth_user_created` trigger.
- Verified storage buckets remain empty.
- Verified no finance tables exist.
- Security advisors report no lints.

Auth bootstrap and RLS runtime test status:

- Email signup testing is pending because Supabase returned an email send rate limit.
- Anonymous signup testing is unavailable because anonymous sign-ins are disabled.
- No test Auth users, profiles rows, or user_preferences rows were created during the attempted tests.
- Full authenticated user-context RLS testing is pending until a normal signup/session can be created.

Next planned step:

- Step 4C should commit the local Step 4/4B files and note that live Auth bootstrap/RLS user-context verification remains pending.

## Step 5 Categories Schema

Status:

- Migration file: `supabase/migrations/20260902211646_create_categories.sql`
- Migration has been applied to the live Supabase project.
- `public.categories` is planned as user-owned rows, not global shared/system categories.
- Default categories are copied into each user's account during new-user bootstrap.
- Local TypeScript table types were added for categories only.
- `src/services/categoryService.ts` and `src/hooks/useCategories.ts` provide isolated category CRUD helpers.
- Existing Categories UI and finance workflows remain on the current local/mock data path.

Categories table model:

- `user_id` references `auth.users(id)` with cascade delete.
- `type` is constrained to `income`, `expense`, `savings`, or `debt`.
- `name` is required and cannot be blank.
- `(user_id, type, name)` is unique.
- `color` is nullable but must be a hex color when present.
- `is_default` marks copied starter categories.
- `is_archived` supports non-destructive category hiding.

RLS ownership model:

- Users can select, insert, update, and delete only their own categories.
- Insert and update policies use `with check ((select auth.uid()) = user_id)`.
- No anon access policy is defined.

Default category bootstrap:

- `public.create_default_categories_for_user(target_user_id uuid)` inserts starter income, expense, savings, and debt categories for a user.
- Inserts use stable `sort_order` values and `on conflict (user_id, type, name) do nothing`.
- `public.handle_new_user()` is updated to preserve profile/preferences bootstrap and then call `public.create_default_categories_for_user(new.id)`.
- Direct execute privileges are revoked from `public`, `anon`, and `authenticated`.

Still not created:

- Transactions table
- Expected transactions table
- Payment methods table
- Savings/debt tables
- Storage buckets
- Finance data page integrations

Pending from Step 4B:

- Runtime Auth bootstrap testing is still pending because email signup hit validation/rate limiting and anonymous Auth is disabled.
- Full authenticated RLS user-context testing is pending until a test auth session can be created.

## Step 5B Apply And Verify Categories

Live apply status:

- Applied live through Supabase MCP as `20260902211646_create_categories`.
- The local migration filename was aligned to the live migration version after apply to avoid migration history drift.
- Verified `public.categories` exists.
- Verified RLS is enabled on `public.categories`.
- Verified owner-scoped select, insert, update, and delete policies exist.
- Verified `public.create_default_categories_for_user(target_user_id uuid)` exists.
- Verified `public.handle_new_user()` calls `public.create_default_categories_for_user(new.id)`.
- Verified `categories_set_updated_at` exists and uses `public.set_updated_at()`.
- Verified storage buckets remain empty.
- Verified no transactions, expected_transactions, payment_methods, savings/debt, budget snapshot, archived budget, or notifications tables exist.
- Security advisors report no lints.

Default category verification:

- Planned defaults were verified from the function source and an equivalent read-only count query.
- Income defaults: 5.
- Expense defaults: 13.
- Savings defaults: 6.
- Debt defaults: 6.
- Total defaults: 30.

Auth bootstrap and RLS runtime test status:

- Runtime signup/bootstrap testing remains pending because recent signup attempts hit email validation/rate limiting and anonymous Auth is disabled.
- Full authenticated user-context category RLS testing is pending until a test auth session can be created.
- No test Auth users or category rows were created during Step 5B.

Next planned step:

- Step 5C should commit the Step 5/5B local files, then Step 6 can define the payment_methods schema.

## Step 6 Payment Methods Schema - 2026-09-02

Payment methods schema status:

- Local migration file: `supabase/migrations/20260902212850_20260902212300_create_payment_methods.sql`.
- The migration defines only `public.payment_methods`.
- The migration has been applied to the live Supabase project.
- Payment methods are user-owned rows.
- Payment methods are not globally defaulted and are not created automatically for new users.
- Users will add their own payment methods because these records represent private financial instruments.
- No transactions, expected transactions, savings/debt tables, or storage buckets are created in this migration.

Payment methods table model:

- `public.payment_methods.user_id` references `auth.users(id)` and cascades on user deletion.
- Payment method `type` is constrained to `cash`, `checking`, `savings`, `credit_card`, `debit_card`, `loan`, `investment`, `digital_wallet`, or `other`.
- `nickname` is required, cannot be blank, and is unique per user.
- `last4` is nullable but must be exactly four digits when present.
- `color_theme` is nullable and must be either a `#RRGGBB` hex value or a short safe token when present.
- A partial unique index allows at most one active default payment method per user.
- `is_archived` supports hiding payment methods without deleting them.

RLS ownership model:

- RLS is enabled on `public.payment_methods`.
- Users can select, insert, update, and delete only rows where `(select auth.uid()) = user_id`.
- Insert and update policies use `with check` so users cannot create or reassign payment methods for another user.
- No anonymous access policy exists for payment methods.

Local integration status:

- `src/types/supabase.ts` includes local types for `payment_methods` only in this step.
- `src/services/paymentMethodService.ts` and `src/hooks/usePaymentMethods.ts` provide isolated payment method helpers.
- `public.set_default_payment_method(target_payment_method_id uuid)` atomically unsets existing active defaults and sets the selected default for the authenticated owner.
- `setDefaultPaymentMethod()` calls the database RPC instead of doing client-side multi-step updates.
- Existing Settings/payment method UI remains connected to the local FinanceOS store, not Supabase.
- Preview/mock payment methods remain separate from Supabase payment methods.

Pending verification:

- Step 4B/5B runtime Auth bootstrap testing remains pending because email signup hit validation/rate limiting and anonymous Auth is disabled.
- Full authenticated user-context RLS testing remains pending until a test auth session can be created.

Next planned step:

- Step 6C should commit the Step 6/6B local files, then Step 7 can design the transactions schema.

## Step 6B Apply And Verify Payment Methods - 2026-09-02

Live apply status:

- Applied the payment_methods migration live through Supabase MCP.
- Live migration history records version `20260902212850` with name `20260902212300_create_payment_methods`.
- The local migration filename was aligned to `supabase/migrations/20260902212850_20260902212300_create_payment_methods.sql` after apply to avoid migration history drift.
- Verified `public.payment_methods` exists.
- Verified RLS is enabled on `public.payment_methods`.
- Verified owner-only select, insert, update, and delete policies exist for payment methods.
- Verified `payment_methods_set_updated_at` exists and executes `public.set_updated_at()`.
- Verified the partial unique index `payment_methods_one_default_per_user_idx` protects one active, non-archived default per user.
- Verified `public.set_default_payment_method(target_payment_method_id uuid)` exists as `security invoker`.
- Verified storage buckets remain empty.
- Verified no transactions, expected_transactions, savings/debt, budget snapshot, archived budget, or notifications tables exist.
- Security advisors report no lints.

Atomic default RPC behavior:

- The RPC requires `auth.uid()` to be present.
- It verifies the target payment method belongs to the current authenticated user.
- It rejects missing, non-owned, or archived targets.
- It updates only rows where `user_id = auth.uid()`.
- Execute permission is granted to `authenticated` and denied to `anon`.

Runtime test status:

- Runtime RPC/RLS testing remains pending until a test authenticated session can be created.
- Runtime Auth bootstrap testing remains pending because recent signup attempts hit email validation/rate limiting and anonymous Auth is disabled.

Recommended next step:

- Step 6C should commit the Step 6/6B local files, then Step 7 can design the transactions schema.

## Step 7 Actual Transactions — Local Only — 2026-09-16

Status and recovery:

- Reused `supabase/migrations/20260909161607_create_transactions.sql`; no second transactions migration was created.
- Recovered the untracked SQL and the partial Step 7 backend-plan notes. No transaction service, hook, or database types existed.
- Preserved applicable schema, RLS, timestamp and ownership constraints. Removed draft pending/fixed-expense columns, the extra `system` source and speculative indexes to match the actual-only scope.
- Transactions migration, TypeScript types, service and hook are implemented locally. The migration has NOT been applied live because Supabase MCP is unavailable due to unsupported OAuth scopes.
- No MCP calls, OAuth attempts, remote SQL, migration renaming or commits belong to this step. Earlier live-state statements in this document are historical and were not reverified.

Frontend audit and integration mismatches:

- Inspected `src/app/data/data.ts`, `src/app/lib/financeStore.tsx`, AddTransaction, IncomeTracker, ExpenseTracker, Categories, Settings and `src/mock/mockFinanceData.ts`.
- Income, expenses, savings contributions and debt payments use the same local Transaction model. Amounts are positive; type controls direction in totals.
- Local shape: `id, name, amount, type, category, date, status`, plus optional `expenseKind, notes, dueDate, isFixed, paymentMethodId`.
- Batch-entry forms collect name/source/merchant, positive amount, category name, ISO date, status, notes and a local payment method ID. Draft preview queues commit to the local store only.
- Backend `title` maps to local `name`; `transaction_date` maps to `date`; `notes` retains its meaning. Nullable `description` has no distinct frontend source yet.
- Local categories are display-name strings (including Uncategorized); backend uses nullable owned UUID references. Payment method IDs are also local strings today. A future adapter must resolve real owned IDs, never reuse local/mock IDs.
- Local IDs use client-generated strings; mock IDs use `mock-*`; pending payment-plan IDs use `payment-plan:*`. Backend IDs are server-generated UUIDs.
- The form defaults to pending. Actual totals exclude pending fixed expenses, but include other transactions regardless of pending/paid/cleared status. Backend rows represent actual events only and have no status, due date or fixed-expense classification. Resolve this semantic mismatch before UI integration; never bulk-copy the local array.
- Expected monthly amounts and payment plans are separate local models. Recurring frequency belongs to PaymentPlan; actual local transactions have no recurring-series metadata.
- Frontend month indexes are 0–11 and activeYear is a string. The service accepts numeric year and month 1–12. Dates are calendar strings, not timestamps.
- There is no transaction provenance/import field. The form's source label means a display name, not backend provenance. Settings import/export controls are placeholders; no importer was added.
- Full local FinanceState remains under `financeos:app-data:v1`. Preview Mode uses a separate reducer with `mockFinanceData` and the `financeos:dev-preview-enabled` toggle.

Schema and financial conventions:

- UUID primary key; required `user_id` references `auth.users(id) ON DELETE CASCADE`.
- Required type, positive `numeric(14,2)` amount, nonblank title and `transaction_date date`. Allowed types: income, expense, savings, debt. Negative/zero and numeric NaN amounts are rejected; expenses/debt remain positive.
- Type determines financial direction. No persisted month/year: `transaction_date` is authoritative.
- Nullable description, notes, category_id, payment_method_id and recurring_group_id; description and notes remain flexible text.
- Source defaults to manual and allows only manual, recurring, import, migration. No import/migration workflow is implemented.
- is_recurring defaults false. created_at/updated_at are non-null timestamps defaulting to now().
- `transactions_set_updated_at` reuses `public.set_updated_at()`; no duplicate helper.

Ownership, foreign keys and RLS:

- Nullable single-column category/payment-method FKs reference their respective public tables and use ON DELETE SET NULL. Historical transactions survive parent deletion. Archiving does not clear references.
- `public.validate_transaction_ownership()` runs BEFORE INSERT OR UPDATE. Every non-null category/payment reference must exist and have user_id equal to NEW.user_id, otherwise a clear exception is raised.
- The helper is SECURITY INVOKER with an empty search_path and fully qualified tables. RLS-hidden and missing references both fail without disclosing another user's records. It is a trigger-only function, with direct execution revoked; no client RPC typing is needed.
- Retained composite owner FKs and parent (user_id, id) unique constraints from the draft as additional protection against concurrent or privileged parent ownership changes. Removed ON UPDATE CASCADE so a parent edit cannot transfer transactions. Composite deletes clear only the reference column, never user_id.
- Both FK relationship paths are reflected in types. Future embedded PostgREST joins must name the intended FK to avoid ambiguous relationships.
- Enabled RLS. Authenticated SELECT/DELETE use `(select auth.uid()) = user_id`; INSERT uses WITH CHECK; UPDATE uses both USING and WITH CHECK. No anonymous policy/access.
- Explicitly revoke public/anon/authenticated table privileges before granting authenticated SELECT/INSERT/UPDATE/DELETE only (no TRUNCATE).
- Four transaction indexes: (user_id, transaction_date DESC), (user_id, type), category_id, payment_method_id. Parent unique constraints also create supporting unique indexes.
- Static security review found no remaining high-confidence Step 7 issue: no unsafe SECURITY DEFINER, service-role use, destructive data SQL, credentials, or caller-controlled identity in service payloads.

Local service, hook and types:

- `src/services/transactionService.ts` provides fetchTransactions, fetchTransactionById, fetchTransactionsByType, fetchTransactionsByDateRange, fetchTransactionsForMonth, createTransaction, updateTransaction and deleteTransaction.
- Every database operation checks the existing client and obtains the current user via Auth.getUser(). Queries explicitly filter by owner. Insert attaches Auth user_id; runtime field allowlisting prevents updates to user_id, id or server timestamps.
- Typed success/failure results use fixed sanitized messages, including thrown network/Auth failures. No raw tokens, errors or server details leave the service.
- Lists are ordered by date then ID descending and fetched in 500-row pages. Offset pagination is not a database snapshot during concurrent edits; revisit cursor/snapshot loading for future high-volume UI. A server row limit below 500 would also require matching this page size.
- fetchTransactionById returns null when absent/inaccessible; update/delete report not_found. Date-range endpoints are inclusive.
- Month queries use first day inclusive and next month's first day exclusive, including December rollover, without timezone conversion. Month 1–12 and year 1–9998 are validated.
- `src/hooks/useTransactions.ts` exposes transactions, isLoading, error, refresh and create/update/delete. It refreshes after successful writes, clears/masks previous-account state, ignores obsolete results after account changes/unmount, and tracks concurrent loading.
- The hook is isolated and unmounted by all existing pages. It supports `enabled: false`; future Preview Mode integration must disable it.
- `src/types/supabase.ts` adds SupabaseTransactionType, SupabaseTransactionSource, Transaction, TransactionInsert, TransactionUpdate and the transactions table/relationship definitions only.

Scope and validation:

- Preview/mock/localStorage data is untouched: no migration, synchronization, seeding, array merging, dashboard replacement or automatic guest upload.
- Recurring engine, templates, cron, Edge Functions and automatic generation are deferred.
- expected_transactions schema/types/services/hooks are deferred to Step 8. No savings/debt tables or storage work.
- Offline service tests: `node --test tests/transactionService.test.mjs` (Node 24) cover identity spoofing, owner filters, missing client/session, safe errors, amount/date validation, month boundaries and pagination. These mock the client and never connect to Supabase.
- Validation results: all 6 offline tests passed; `npm run typecheck`, `npm run build` and `git diff --check` passed. New untracked files were also whitespace-checked. Lint unavailable (no lint script). Build retains the large-chunk warning; Node reports its experimental type-stripping API; Git reports existing CRLF-to-LF normalization for guidelines.md.
- Runtime Auth/RLS, trigger/FK delete behavior and migration execution testing remain deferred to a later validation phase; static checks and mocked tests do not prove live enforcement.
- Step 7B recommendation: review this local diff and validate in an explicitly authorized local/test database using two authenticated users plus anon. Exercise CRUD isolation, mismatched references, ownership reassignment, null references, parent deletion/archive, timestamps and date boundaries. Verify the existing Auth bootstrap separately. Live application requires a separate explicit instruction after access is restored; keep this filename and do not mark it applied now.
