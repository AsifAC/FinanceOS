# Snapshot and archive storage

## Production migration status

Migration `20261001012942_budget_snapshots` was applied to the FinanceOS
production project (`zmbyqstmgtdbyvczuvki`) and inspected on 2026-09-30. The
remote migration history includes this migration and the expected earlier
FinanceOS migrations. Read-only catalog inspection confirmed the deployed
columns, owner foreign key, period/source/version/summary constraints, owner
period index, `updated_at` trigger, RLS policies, and role grants match the
repository migration. No production users or test snapshots were created.

This checkout is linked to the production project. Always target local
operations explicitly where the CLI supports it (for example,
`supabase db reset --local` and `supabase db push --local`). Do not casually run
`supabase db push`: its default target is the linked production project. Any
future remote migration requires separate review and successful local
verification first.

New monthly and annual snapshots are stored in the Supabase `budget_snapshots`
table. Ownership is derived from the authenticated session and enforced by
owner-scoped row-level security (RLS) policies. The browser client does not use
a service-role key.

The stable snapshot summary is stored as JSONB. It preserves captured actual
and expected totals, rates, category and month breakdowns, transaction and
pending counts, notes, and source/version metadata. Scope, year, month, and
owner are separate columns for access control and filtering. Months are
zero-based: `0` is January and `11` is December. Yearly snapshots use a null
month. Same-period saves may create multiple rows; an overwrite targets the
intended latest account-owned row, while "Save as new version" inserts a new
UUID.

Actual values and actual transaction counts are captured from the current
authenticated account's Supabase transactions. Expected values, pending-plan
counts, and planning metadata still come from local FinanceOS planning state at
capture time. Annual Planner actual calculations use Supabase transactions;
its expected amounts and planning calculations remain local.

Opening or exporting an account snapshot uses its stored JSONB payload and
never recomputes it from current transactions. Notes and deletion are
account-scoped. Existing browser-local archives are not uploaded, removed,
merged, or rewritten. They remain in a separately labeled read-only "Legacy
local archives" section and are not account-owned records. Other planning
state may continue to use `financeos:app-data:v1`.

## Local database verification

The repository migration is `supabase/migrations/20261001012942_budget_snapshots.sql`.
The pgTAP integration test is
`supabase/tests/budget_snapshots.test.sql`; it checks the real table shape,
grants, RLS, JSONB round-trip, owner CRUD, cross-owner isolation, owner spoofing,
period/scope constraints, and independent same-period versions.

Local verification passed after a clean local reset. The pgTAP suite passed
27/27 both after that reset and during production verification. To repeat the
test, first verify that `supabase status` reports the local stack and that its
API/database URLs are local. Then run:

```sh
supabase db reset --local
supabase test db --local
```

`db reset --local` resets that local database and applies repository
migrations; it is destructive to data in that local database. The pgTAP test
creates two temporary authenticated users inside a rolled-back transaction.
Account A and Account B each exercise their own row; each must be unable to
select or mutate the other account's row. The test also verifies that an
attempt to supply the other owner's `user_id` is rejected by RLS. No
service-role bypass is used for those authenticated assertions.

Do not use `--linked`, a remote database URL, or `db push` for this local test.
Never use the live FinanceOS project (`zmbyqstmgtdbyvczuvki`) as a test target.
Existing JavaScript migration-contract tests remain static checks and do not
replace pgTAP against a real local database.

Expected events and their atomic completion RPC are deployed. Monthly budget
targets remain separate/local. Recurrence, undo completion, and local planning
imports remain deferred; snapshot semantics are unchanged.
