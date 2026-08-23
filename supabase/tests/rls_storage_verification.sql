-- FinanceOS manual verification checks.
-- Run only in a disposable Supabase project or test branch after reviewing migrations.

-- 1. Confirm every app table has RLS enabled.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'user_preferences',
    'categories',
    'payment_methods',
    'transactions',
    'expected_transactions',
    'savings_goals',
    'savings_contributions',
    'debts',
    'debt_payments',
    'budget_snapshots',
    'archived_budgets',
    'notifications',
    'reports_cache',
    'uploaded_files'
  )
order by tablename;

-- 2. Confirm auth.uid() = user_id appears in policies for every user-owned table.
select schemaname, tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. Confirm signup automation exists.
select trigger_name, event_object_schema, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';

-- 4. Confirm storage buckets exist and remain private.
select id, name, public
from storage.buckets
where id in ('avatars', 'receipts', 'exports', 'attachments')
order by id;

-- 5. Confirm storage policies check the first path folder against auth.uid().
select schemaname, tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- Application-level checks to perform with two real test users:
-- - User A cannot select User B rows from any FinanceOS table.
-- - User A cannot update or delete User B rows.
-- - User A signup creates one profile, one user_preferences row, and default categories.
-- - Transaction CRUD and expected transaction CRUD work for the signed-in user.
-- - Storage uploads fail unless the path starts with the signed-in user id.
-- - Annual PDF exports save under exports/{user_id}/{year}/FinanceOS-Annual-Report-{year}.pdf.
