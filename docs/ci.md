# Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests targeting
`main`, using Ubuntu, Node 22, and npm's lockfile-based dependency cache.

The job runs `npm ci`, `npm run typecheck`, `npm run build`, and
`node --test tests/*.test.mjs`. The test command includes every existing service
suite once:

- `authService.test.mjs`: signup, login, sessions, signout, and safe errors.
- `verificationService.test.mjs`: verification flags, mocked OTP delivery,
  identity checks, and profile-write restrictions.
- `transactionService.test.mjs`: validation, ownership filters, date ranges,
  pagination, and safe errors.
- `transactionDates.test.mjs`: calendar-date validation, leap years, timezone
  independence, and year/month filtering.
- `actualTransactionDrafts.test.mjs`: actual-only create-field mapping, nullable
  category/payment UUIDs, positive two-decimal amount validation, and date checks.
- `categoryLabels.test.mjs`: category label resolution, null/unknown references,
  archived historical labels, and neutral loading text.
- `paymentMethodLabels.test.mjs`: backend nickname resolution, null/unknown
  references, neutral loading/error labels, archived methods, and default metadata.
- `selectableCategories.test.mjs`: per-type category selection and archived-row
  exclusion while retaining backend UUIDs.
- `metadataOwnership.test.mjs`: captured-account checks before category and
  payment-method writes, including default RPC calls and owner-spoof prevention.

Additional offline `tests/*.test.mjs` suites are picked up automatically. Keep
that naming convention for tests that run without live credentials or services.
There are currently no other tests runnable from the locked dependencies alone.

No environment file, GitHub secret, service-role key, live login, SMS/email
delivery, or existing browser storage is needed. The service suites replace the
configured client with mocks. The build validates the unconfigured application;
it is not a deployment. The workflow does not print environment values or upload
build artifacts.

## Tests outside CI

- `tests/transactionsBrowser.mjs` checks the isolated actual-transactions ledger
  with mocked auth, transaction, category, and payment-method responses,
  including account switching, stale responses, fetch failures, and unchanged
  legacy storage. It also covers account-backed category CRUD, archive/restore,
  owner mutation races, payment-method create/edit/archive/default flows and
  account switching. Selectable filtering is covered by
  `tests/selectablePaymentMethods.test.mjs`. Run against
  `npm run dev` with
  `node tests/transactionsBrowser.mjs`. Set `CHROME_PATH` for your local Chrome
  installation and `TRANSACTIONS_REVIEW_URL` for a non-default dev server URL.
  It uses an isolated profile and blocks remote requests; no credentials or
  live account are needed. This remains a local browser check, not hosted CI.

- `tests/authBrowser.mjs` is a manual headless Chrome harness. It defaults to a
  Windows Chrome executable, expects a running Vite dev server, and uses a fixed
  debugging port. A graphical desktop is not required, but reliable Ubuntu CI
  setup and browser lifecycle handling have not been established. It uses an
  isolated browser profile, mocks auth/delivery, and blocks Supabase requests.
  Run it locally with the dev server running; set `CHROME_PATH` and
  `AUTH_REVIEW_URL` when needed.
- `tests/verificationDatabase.mjs` uses disposable local PGlite, not live
  Supabase. It imports `@electric-sql/pglite@0.3.14` from a separately prepared
  temporary directory. That dependency is absent from `package-lock.json`, so
  `npm ci` cannot provision this harness. Keep it as the documented manual
  database check until its dependencies and setup are part of the locked test
  environment.
- Real-session restoration and actual email/SMS delivery remain manual checks.

## Local validation

Use a current Node 22 release (22.13 or newer is required by the tests' built-in
`stripTypeScriptTypes` API), then run:

```sh
npm ci
npm run typecheck
npm run build
node --test tests/*.test.mjs
git diff --check
```

For a credential-free build check, use a disposable checkout without `.env`
files. Do not remove or print your working checkout's local environment file.

Atomic expected-event completion has local database checks. After starting
local Supabase, run `supabase db reset --local` and `supabase test db --local`.
Run `node tests/expectedCompletionConcurrency.mjs` for two overlapping
authenticated requests in `supabase_db_FinanceOS`. It has no remote URL option,
creates disposable local fixtures and removes them afterward. It is opt-in,
outside standard unit-only CI, and requires Docker/local Supabase.

The release validation on 2026-10-02 passed 87 Node tests and 169 local pgTAP
assertions, plus both browser harnesses and the completion concurrency test.
Responsive checks cover 375, 768, 1024, and 1440 pixels. Never direct database
tests at the linked production project. See [release.md](release.md) for the
hosting configuration, source-of-truth boundaries, and release follow-ups.
