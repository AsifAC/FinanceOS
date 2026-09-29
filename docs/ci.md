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

Additional offline `tests/*.test.mjs` suites are picked up automatically. Keep
that naming convention for tests that run without live credentials or services.
There are currently no other tests runnable from the locked dependencies alone.

No environment file, GitHub secret, service-role key, live login, SMS/email
delivery, or existing browser storage is needed. The service suites replace the
configured client with mocks. The build validates the unconfigured application;
it is not a deployment. The workflow does not print environment values or upload
build artifacts.

## Tests outside CI

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
