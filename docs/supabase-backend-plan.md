# FinanceOS Supabase Backend Plan

## Project

- Supabase URL: https://zmbyqstmgtdbyvczuvki.supabase.co
- Backend rebuild status: Auth foundation added locally; no database schema created
- Clean checkpoint: `e435950 chore: reset Supabase backend foundation`

## Current Status

- Public tables: not created yet
- Public RLS policies: not created yet
- Storage buckets: not created yet
- Edge functions: not created yet
- Public database functions/triggers: not created yet
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
