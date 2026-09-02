# FinanceOS Supabase Backend Plan

## Project

- Supabase URL: https://zmbyqstmgtdbyvczuvki.supabase.co
- Backend rebuild status: profiles and user_preferences migration created locally; not applied live
- Clean checkpoint: `e435950 chore: reset Supabase backend foundation`

## Current Status

- Public tables: profiles and user_preferences are defined in a local migration only
- Public RLS policies: profiles and user_preferences ownership policies are defined in a local migration only
- Storage buckets: not created yet
- Edge functions: not created yet
- Public database functions/triggers: profile/preferences timestamp and new-user bootstrap functions are defined in a local migration only
- Frontend screens remain on the existing local/mock data path
- Supabase Auth service/provider exists locally and is not used for finance data yet

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

Tables are planned but not created yet:

- profiles
- user_preferences
- categories
- payment_methods
- transactions
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
