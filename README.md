# FinanceOS

FinanceOS is a modern budgeting dashboard UI for tracking income, expenses, savings, debt, reports, payment methods, notifications, settings, and budget snapshots in one fintech-style workspace.

## Features

- FinanceOS dashboard
- Income tracking
- Expense tracking
- Savings tracking
- Debt tracking
- Reports
- Budget snapshots
- Payment methods
- Notifications
- Settings
- Timezone support
- Landing page
- Light and dark mode
- Modern fintech UI

## Current Status

The release architecture and deployment procedure are recorded in
[docs/release.md](docs/release.md). Production hosting uses the existing Vercel
`finance-os` project and `www.financeos.com`, with GitHub `main` as the production
branch. Only the live Supabase URL and publishable key belong in frontend
configuration; `.env.local` and `.vercel` runtime files stay ignored.

Account verification onboarding is implemented; the approved database migration was applied live on 2026-09-26. Email and SMS delivery are currently disabled (`VITE_EMAIL_OTP_READY=false`, `VITE_PHONE_OTP_READY=false`). Account verification enforcement is temporarily disabled for development/manual testing through `VITE_ACCOUNT_VERIFICATION_REQUIRED=false` (also the default when unset). Authenticated users reach the application regardless of `profiles.account_verified_at`; bypassing never changes that timestamp or marks anyone verified. With the flag set to `true`, unverified users are routed to `/auth/verify` and verified users may access app pages. Logout remains available during onboarding and returns to landing through AuthProvider. No Auth configuration changes have been made.

The preserved verification page redirects authenticated users to `/dashboard` when enforcement is off. When enforcement is on, it offers Email and Phone on the same existing account only as selectable options when their delivery flags are enabled; unavailable methods are disabled and labeled honestly. Before enabling it:

1. Database prerequisite completed: `supabase/migrations/20260926210523_account_verification.sql` was approved and applied live. It adds four nullable profile fields, restricts direct verification writes, and adds a confirmation-checking RPC. No accounts were backfilled. Do not reapply it.
2. In Supabase Dashboard → Authentication → Email Templates → Magic Link, configure a numeric code using `{{ .Token }}`. Ensure Email provider/SMTP delivery and six-digit OTP length are configured. Keep signup confirmation behavior separate; an account without a session must first complete normal signup confirmation/login. See [email OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless).
3. In Authentication → Sign In / Providers → Phone, enable Phone with a supported SMS provider and phone confirmation enabled. Configure provider credentials securely in Supabase, never frontend code. See [phone change verification](https://supabase.com/docs/guides/auth/phone-login#updating-a-phone-number).
4. Only after reviewing the corresponding delivery settings, set the nonsecret deployment flags `VITE_EMAIL_OTP_READY=true` and/or `VITE_PHONE_OTP_READY=true`, then restart/rebuild. These are readiness controls, not security controls. Manually test delivery with the existing account; neither channel has been verified operational here.

MCP read-only access confirmed the existing profile schema and RLS. Its available tools do not expose Auth provider/template configuration; SMS provider and numeric email-template readiness remain unknown. Production should re-enable enforcement with `VITE_ACCOUNT_VERIFICATION_REQUIRED=true` after at least one delivery provider is configured and manually tested. Restart/rebuild after changing Vite flags. If enforcement is enabled before delivery is ready, unverified users see an unavailable-delivery message and can log out.

Email requests use the existing Auth email with `shouldCreateUser: false`. Phone uses authenticated `updateUser` and `phone_change` OTP confirmation. Profile phone numbers are copied from confirmed Auth data as E.164 by the database function; email completion preserves phone fields. No OTPs, tokens, or passwords are stored in profiles. This is onboarding, not an MFA guarantee or a replacement for financial-table RLS.

Initial Budget UI release prepared as `v0.1.0-budget-ui`.

Developer Preview has been removed. `/`, `/auth/login`, and `/auth/signup` are public; all application pages require authentication through the existing AuthProvider and RequireAuth. Signed-out visitors see Login and Sign up; signed-in visitors see Go to Dashboard and are redirected away from login/signup.

`/transactions` is an authenticated Supabase ledger with actual transaction create/edit/delete. `/expected-transactions` is a separate account-backed ledger for dated planned events, with create/edit/cancel/reopen/delete actions for planned or cancelled rows only. Completed expected rows remain historical/read-only. Expected-event create inputs use owned category/payment UUIDs, date-only validation, and server-provided ID/owner/planned defaults. The screen never imports local expected targets, fixed expenses, or payment plans. The expected-event schema and privilege hardening were deployed to production on 2026-10-01 and verified read-only. The repository client now enables hosted expected-event CRUD; the frontend release includes that hosted behavior. If another configured project lacks the schema, requests fail safely without local fallback. Atomic completion is production-deployed and enabled in the release frontend. Recurrence remains deferred.

`/categories` is an authenticated account-backed management screen using Supabase category UUIDs as identity. Both screens are isolated from the browser-local financial provider. Category labels resolve by UUID; archived names remain visible historically and archived categories are excluded from future selection. Category type is fixed after creation in the management UI because changing it could make historical transaction/category types inconsistent. Categories are provisioned by the backend on account creation and display their default metadata; the management screen does not create defaults. It supports create, edit, archive, and restore. Permanent delete is omitted because the transaction foreign key sets historical `category_id` values to null on deletion. The backend enforces uniqueness by owner, type, and name.

Payment-method labels resolve to the authenticated user's backend nickname, including archived methods returned by the read. Null references show “Not assigned”; unresolved references show neutral labels. Local categories and payment methods remain legacy-only; payment-method management is account-backed at `/payment-methods`. Payment-method labels use backend nicknames without coercing backend types such as `loan`, `investment`, or `digital_wallet` into legacy types. The backend permits one active default per user; the ledger does not change or select defaults. Actual transaction create/edit/delete are account-backed at `/add-transaction` and `/transactions`, using server UUIDs and owned category/payment-method UUIDs. Edit/delete apply only to actual Supabase rows; planned/pending obligations and local legacy transactions are excluded. Dashboard actual KPIs, Quick Summary, Best Savings Month, and the actual cashflow series use authenticated Supabase transactions. Reports live actual totals, charts, and expense category breakdowns use authenticated Supabase transactions and account-backed category UUID labels. Newly created or explicitly re-saved monthly/yearly snapshots use the current authenticated account's Supabase actuals and local expected/planned values. Snapshot metadata records the source and version; transaction counts include only actual Supabase rows in the saved period. Account snapshots are stored in Supabase and isolated by owner RLS; their stored payload is displayed/exported without recalculation. Existing browser-local snapshots remain untouched, are not uploaded, and are available only in the separately labeled Legacy local archives section. Expected-event migrations and column privileges are production-deployed; atomic completion is production-deployed, while recurrence remains deferred.

Dashboard, Reports, Annual Planner, Income, Expenses, and Savings actual calculations use authenticated Supabase transactions. Income and expense rows use account-backed UUID category labels. Expenses keeps fixed obligations and their local Mark Paid planning status in a clearly separate browser-local section; marking a plan paid does not record an actual transaction. Savings actual contributions and charts use account transactions, while expected targets remain local. No dedicated Debt screen exists; debt actuals use the shared Dashboard, Reports, and Annual Planner actual transaction aggregation. Pending obligations, payment plans, savings goals/targets, expected amounts, selected period metadata, and other planning state remain browser-local. Actual screens distinguish loading/error from a valid empty account and never fall back to local actual rows. Legacy local transactions and snapshots are preserved and are not uploaded, migrated, seeded, recalculated, or merged. Retained mock fixtures are disconnected from application pages. Expected-event schema and hardening are production-deployed; atomic completion is production-deployed; recurrence and legacy planning import remain deferred.

### Manual access checks

Use your existing real account; automated tests must not create live accounts or financial records.

1. Signed out, open `/`: verify Login, Sign up, signup CTAs, and no Developer Preview controls.
2. Open `/dashboard` or `/settings` directly: expect login without protected content flashing.
3. Log in with your existing account: with enforcement off, expect the dashboard and local-data notice without verification onboarding. With enforcement on, expect onboarding until verified. Verify logout works in both modes. Once delivery is configured, manually test the chosen code flow without creating another account.
4. Refresh the dashboard, then navigate across financial pages: access should persist.
5. Visit `/`, `/auth/login`, and `/auth/signup` while signed in: expect dashboard navigation on landing and redirects from auth pages.
6. Use the profile menu's Log out: expect the landing page. Retry a protected URL and browser Back: protected access must be denied; local records must remain intact.
7. Signed out, inspect signup validation. A real signup/email-confirmation flow is user-driven only; offline tests cover signup responses without creating an account.

Validation commands: `npm run typecheck`, `npm run build`, `node --test tests/authService.test.mjs tests/transactionService.test.mjs`, and `git diff --check`. With the dev server running, `node tests/authBrowser.mjs` checks auth UI and route guards using isolated browser storage and mocked sessions. Real-session restoration after refresh still needs the manual check above. No lint script exists.

Verification service tests: `node --test tests/verificationService.test.mjs`. Database checks: install `@electric-sql/pglite@0.3.14` in your temporary directory under `financeos-verification-db-test`, then run `node tests/verificationDatabase.mjs`. These execute only in disposable local PostgreSQL, with mock Auth identities; they never contact Supabase. Browser tests block Supabase requests and mock delivery, including invalid codes, cooldown, preference persistence, and same-account phone confirmation.

`/payment-methods` is the authenticated, isolated account-backed management screen. Backend UUIDs identify methods, and the existing RPC manages the single active default. It supports all schema method types (`cash`, `checking`, `savings`, `credit_card`, `debit_card`, `loan`, `investment`, `digital_wallet`, and `other`) without legacy coercion. Archived methods remain available for historical labels and are excluded from future selection. Permanent deletion is omitted because the transaction foreign key sets historical `payment_method_id` references to null. Payment-method management was local in Settings before this migration; local methods remain legacy-only and are not merged or migrated. Account-backed transaction create/edit/delete are available for actual records; Dashboard, Reports, Annual Planner, and new snapshot actuals come from Supabase. Expected/planned values, Annual Planner planning calculations, and pending obligations remain local. Snapshot archives are account-backed with owner RLS, while old local snapshots remain separately viewable as read-only legacy records. Stored snapshot export does not recalculate historical values. Expected events support planned-event CRUD, with atomic completion now production-deployed; recurrence remains deferred.

## Running the Project

Copy `.env.example` to `.env.local` and fill in your project URL and public anon key locally. The restored template contains empty credentials and all three verification flags set to `false`; never place secrets in frontend environment variables.

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

## Expected transactions

`/expected-transactions` is an authenticated, account-backed ledger of dated
planned events. It is separate from actual transactions (`/transactions`),
browser-local monthly budget targets, fixed-expense plans, and payment-plan
recurrence definitions. It does not fall back to browser-local planning data.

The schema and completion-field hardening migrations were deployed to
`zmbyqstmgtdbyvczuvki` on 2026-10-01 and verified from production metadata.
The repository client uses the configured authenticated Supabase client; a
project without the table reports a safe fetch/mutation error and never falls
back to local state. The release frontend enables this hosted behavior. Monthly targets remain local; recurrence generation remains deferred.
No local fixed plans,
pending rows, or targets are imported. Completed rows are historical/read-only;
**Record as completed** uses one atomic RPC, deployed and metadata/security
verified in production during Step 8G on 2026-10-02.
It creates one new actual transaction and retains the completed expected event
as history. Retries return the existing actual UUID. The dialog keeps the event
type and defaults the actual date to its expected date; archived category or
payment references must be replaced with active references or cleared.
Linked actual deletion is restricted; undo completion is not implemented.
Migration `20261002184257_complete_expected_transaction.sql` is deployed to
`zmbyqstmgtdbyvczuvki`. Both function signatures, security modes, empty search
paths, execution grants, and existing table protections were inspected live.
PUBLIC/anon cannot execute the RPC; authenticated clients can. The private
implementation is excluded from the Data API. No production test users or
financial records were created. Hosted completion is enabled in the release frontend
alongside expected-event CRUD. A missing RPC fails safely without local or multi-call
fallback. Undo completion, recurrence, and planning imports remain deferred.
