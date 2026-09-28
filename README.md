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

Account verification onboarding is implemented; the approved database migration was applied live on 2026-09-26. Delivery configuration remains pending. Authenticated users without `profiles.account_verified_at` are routed to `/auth/verify`; verified users may access app pages. Logout remains available during onboarding and returns to landing through AuthProvider. No Auth configuration changes have been made.

The verification page offers Email and Phone on the same existing account. Delivery is safely disabled by default. Before enabling it:

1. Database prerequisite completed: `supabase/migrations/20260926210523_account_verification.sql` was approved and applied live. It adds four nullable profile fields, restricts direct verification writes, and adds a confirmation-checking RPC. No accounts were backfilled. Do not reapply it.
2. In Supabase Dashboard → Authentication → Email Templates → Magic Link, configure a numeric code using `{{ .Token }}`. Ensure Email provider/SMTP delivery and six-digit OTP length are configured. Keep signup confirmation behavior separate; an account without a session must first complete normal signup confirmation/login. See [email OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless).
3. In Authentication → Sign In / Providers → Phone, enable Phone with a supported SMS provider and phone confirmation enabled. Configure provider credentials securely in Supabase, never frontend code. See [phone change verification](https://supabase.com/docs/guides/auth/phone-login#updating-a-phone-number).
4. Only after reviewing the corresponding delivery settings, set the nonsecret deployment flags `VITE_EMAIL_OTP_READY=true` and/or `VITE_PHONE_OTP_READY=true`, then restart/rebuild. These are readiness controls, not security controls. Manually test delivery with the existing account; neither channel has been verified operational here.

MCP read-only access confirmed the existing profile schema and RLS. Its available tools do not expose Auth provider/template configuration; SMS provider and numeric email-template readiness remain unknown. Until prerequisites are met, unverified users see onboarding with an unavailable-delivery message and can log out; dashboard access remains closed.

Email requests use the existing Auth email with `shouldCreateUser: false`. Phone uses authenticated `updateUser` and `phone_change` OTP confirmation. Profile phone numbers are copied from confirmed Auth data as E.164 by the database function; email completion preserves phone fields. No OTPs, tokens, or passwords are stored in profiles. This is onboarding, not an MFA guarantee or a replacement for financial-table RLS.

Initial Budget UI release prepared as `v0.1.0-budget-ui`.

Developer Preview has been removed. `/`, `/auth/login`, and `/auth/signup` are public; all application pages require authentication through the existing AuthProvider and RequireAuth. Signed-out visitors see Login and Sign up; signed-in visitors see Go to Dashboard and are redirected away from login/signup.

Financial pages still use browser-wide localStorage, explicitly labeled **Local browser workspace**. These records are shared between accounts on the same browser and are not Supabase account data. Existing records are preserved; nothing is automatically uploaded, migrated, seeded, or merged. Retained mock fixtures are disconnected from application pages. Financial Supabase integration is incomplete; Step 8 / expected_transactions remains paused.

### Manual access checks

Use your existing real account; automated tests must not create live accounts or financial records.

1. Signed out, open `/`: verify Login, Sign up, signup CTAs, and no Developer Preview controls.
2. Open `/dashboard` or `/settings` directly: expect login without protected content flashing.
3. Log in with your existing account: expect verification onboarding until verified, then the dashboard and local-data notice. Verify logout also works from onboarding. Once delivery is configured, manually test the chosen code flow without creating another account.
4. Refresh the dashboard, then navigate across financial pages: access should persist.
5. Visit `/`, `/auth/login`, and `/auth/signup` while signed in: expect dashboard navigation on landing and redirects from auth pages.
6. Use the profile menu's Log out: expect the landing page. Retry a protected URL and browser Back: protected access must be denied; local records must remain intact.
7. Signed out, inspect signup validation. A real signup/email-confirmation flow is user-driven only; offline tests cover signup responses without creating an account.

Validation commands: `npm run typecheck`, `npm run build`, `node --test tests/authService.test.mjs tests/transactionService.test.mjs`, and `git diff --check`. With the dev server running, `node tests/authBrowser.mjs` checks auth UI and route guards using isolated browser storage and mocked sessions. Real-session restoration after refresh still needs the manual check above. No lint script exists.

Verification service tests: `node --test tests/verificationService.test.mjs`. Database checks: install `@electric-sql/pglite@0.3.14` in your temporary directory under `financeos-verification-db-test`, then run `node tests/verificationDatabase.mjs`. These execute only in disposable local PostgreSQL, with mock Auth identities; they never contact Supabase. Browser tests block Supabase requests and mock delivery, including invalid codes, cooldown, preference persistence, and same-account phone confirmation.

## Running the Project

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
