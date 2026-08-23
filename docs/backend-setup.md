# FinanceOS Backend Setup

FinanceOS is prepared for a Supabase backend, but database changes are not applied automatically from this repo. Review the migrations in `supabase/migrations/` before running them against any project.

## Environment

Create a local `.env` from `.env.example` and fill only frontend-safe values:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Do not add the Supabase service role key to the frontend app.

## Package Install TODO

`@supabase/supabase-js` is not currently installed. The install step was intentionally left as a TODO because npm DNS failed with `getaddrinfo ENOTFOUND registry.npmjs.org`.

Retry when network/DNS is available:

```sh
npm install @supabase/supabase-js
npx skills add supabase/agent-skills
```

## Files Prepared

- `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- `src/lib/supabaseClient.ts` browser client
- `src/services/` typed Supabase service wrappers
- `src/hooks/` service-backed React hooks for gradual integration
- `supabase/migrations/202606280001_core_schema.sql`
- `supabase/migrations/202606280002_indexes.sql`
- `supabase/migrations/202606280003_rls_policies.sql`
- `supabase/migrations/202606280004_auth_defaults.sql`
- `supabase/migrations/202606280005_storage.sql`
- `supabase/tests/rls_storage_verification.sql`

## Migration Review Notes

The prepared schema is additive and creates the requested FinanceOS tables in `public`.

User-owned tables include a `user_id` column referencing `auth.users(id)`:

- `profiles`
- `user_preferences`
- `categories`
- `payment_methods`
- `transactions`
- `expected_transactions`
- `savings_goals`
- `savings_contributions`
- `debts`
- `debt_payments`
- `budget_snapshots`
- `archived_budgets`
- `notifications`
- `reports_cache`
- `uploaded_files`

RLS is enabled for every table, and each table has select, insert, update, and delete policies scoped to `auth.uid() = user_id`.

Storage buckets:

- `avatars`: profile pictures, private signed URL read, path `avatars/{user_id}/avatar.png`
- `receipts`: private receipts, path `receipts/{user_id}/{transaction_id}/{filename}`
- `exports`: private annual reports and exported files, path `exports/{user_id}/{year}/FinanceOS-Annual-Report-{year}.pdf`
- `attachments`: private supporting files, path `attachments/{user_id}/{entity_type}/{entity_id}/{filename}`

Storage policies require the first path folder to equal `auth.uid()::text`.

## Manual Apply Steps

1. Install missing packages when network is available.
2. Fill `.env` with the Supabase project URL and anon key.
3. Review all SQL files in `supabase/migrations/`.
4. Apply migrations through the Supabase dashboard SQL editor or the Supabase CLI.
5. Run the checks in `supabase/tests/rls_storage_verification.sql` on a disposable test branch/project.
6. Wire app persistence from `localStorage` to Supabase in the documented integration order.

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

## Remaining TODOs

- Install `@supabase/supabase-js` once npm can resolve `registry.npmjs.org`.
- Retry `npx skills add supabase/agent-skills` once npm DNS works.
- Implement FinanceOS auth UI and account-scoped data loading.
- Replace placeholder logout/session behavior in `src/app/lib/session.ts`.
- Add typed Supabase row mappers between `FinanceState` and the database tables.
