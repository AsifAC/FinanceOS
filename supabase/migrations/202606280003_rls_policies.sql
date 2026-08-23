-- FinanceOS RLS policies.
-- Every user-owned table is scoped by auth.uid() = user_id.

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.transactions enable row level security;
alter table public.expected_transactions enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_contributions enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.budget_snapshots enable row level security;
alter table public.archived_budgets enable row level security;
alter table public.notifications enable row level security;
alter table public.reports_cache enable row level security;
alter table public.uploaded_files enable row level security;

create policy "profiles select own rows" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles insert own rows" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles update own rows" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles delete own rows" on public.profiles for delete using (auth.uid() = user_id);

create policy "user_preferences select own rows" on public.user_preferences for select using (auth.uid() = user_id);
create policy "user_preferences insert own rows" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "user_preferences update own rows" on public.user_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_preferences delete own rows" on public.user_preferences for delete using (auth.uid() = user_id);

create policy "categories select own rows" on public.categories for select using (auth.uid() = user_id);
create policy "categories insert own rows" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories update own rows" on public.categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories delete own rows" on public.categories for delete using (auth.uid() = user_id);

create policy "payment_methods select own rows" on public.payment_methods for select using (auth.uid() = user_id);
create policy "payment_methods insert own rows" on public.payment_methods for insert with check (auth.uid() = user_id);
create policy "payment_methods update own rows" on public.payment_methods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payment_methods delete own rows" on public.payment_methods for delete using (auth.uid() = user_id);

create policy "transactions select own rows" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions insert own rows" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions update own rows" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions delete own rows" on public.transactions for delete using (auth.uid() = user_id);

create policy "expected_transactions select own rows" on public.expected_transactions for select using (auth.uid() = user_id);
create policy "expected_transactions insert own rows" on public.expected_transactions for insert with check (auth.uid() = user_id);
create policy "expected_transactions update own rows" on public.expected_transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expected_transactions delete own rows" on public.expected_transactions for delete using (auth.uid() = user_id);

create policy "savings_goals select own rows" on public.savings_goals for select using (auth.uid() = user_id);
create policy "savings_goals insert own rows" on public.savings_goals for insert with check (auth.uid() = user_id);
create policy "savings_goals update own rows" on public.savings_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "savings_goals delete own rows" on public.savings_goals for delete using (auth.uid() = user_id);

create policy "savings_contributions select own rows" on public.savings_contributions for select using (auth.uid() = user_id);
create policy "savings_contributions insert own rows" on public.savings_contributions for insert with check (auth.uid() = user_id);
create policy "savings_contributions update own rows" on public.savings_contributions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "savings_contributions delete own rows" on public.savings_contributions for delete using (auth.uid() = user_id);

create policy "debts select own rows" on public.debts for select using (auth.uid() = user_id);
create policy "debts insert own rows" on public.debts for insert with check (auth.uid() = user_id);
create policy "debts update own rows" on public.debts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "debts delete own rows" on public.debts for delete using (auth.uid() = user_id);

create policy "debt_payments select own rows" on public.debt_payments for select using (auth.uid() = user_id);
create policy "debt_payments insert own rows" on public.debt_payments for insert with check (auth.uid() = user_id);
create policy "debt_payments update own rows" on public.debt_payments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "debt_payments delete own rows" on public.debt_payments for delete using (auth.uid() = user_id);

create policy "budget_snapshots select own rows" on public.budget_snapshots for select using (auth.uid() = user_id);
create policy "budget_snapshots insert own rows" on public.budget_snapshots for insert with check (auth.uid() = user_id);
create policy "budget_snapshots update own rows" on public.budget_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budget_snapshots delete own rows" on public.budget_snapshots for delete using (auth.uid() = user_id);

create policy "archived_budgets select own rows" on public.archived_budgets for select using (auth.uid() = user_id);
create policy "archived_budgets insert own rows" on public.archived_budgets for insert with check (auth.uid() = user_id);
create policy "archived_budgets update own rows" on public.archived_budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "archived_budgets delete own rows" on public.archived_budgets for delete using (auth.uid() = user_id);

create policy "notifications select own rows" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications insert own rows" on public.notifications for insert with check (auth.uid() = user_id);
create policy "notifications update own rows" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications delete own rows" on public.notifications for delete using (auth.uid() = user_id);

create policy "reports_cache select own rows" on public.reports_cache for select using (auth.uid() = user_id);
create policy "reports_cache insert own rows" on public.reports_cache for insert with check (auth.uid() = user_id);
create policy "reports_cache update own rows" on public.reports_cache for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reports_cache delete own rows" on public.reports_cache for delete using (auth.uid() = user_id);

create policy "uploaded_files select own rows" on public.uploaded_files for select using (auth.uid() = user_id);
create policy "uploaded_files insert own rows" on public.uploaded_files for insert with check (auth.uid() = user_id);
create policy "uploaded_files update own rows" on public.uploaded_files for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "uploaded_files delete own rows" on public.uploaded_files for delete using (auth.uid() = user_id);
