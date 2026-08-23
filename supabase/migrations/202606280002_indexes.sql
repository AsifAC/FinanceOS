-- FinanceOS indexes.

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists payment_methods_user_id_idx on public.payment_methods(user_id);
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists expected_transactions_user_id_idx on public.expected_transactions(user_id);
create index if not exists savings_goals_user_id_idx on public.savings_goals(user_id);
create index if not exists savings_contributions_user_id_idx on public.savings_contributions(user_id);
create index if not exists debts_user_id_idx on public.debts(user_id);
create index if not exists debt_payments_user_id_idx on public.debt_payments(user_id);
create index if not exists budget_snapshots_user_id_idx on public.budget_snapshots(user_id);
create index if not exists archived_budgets_user_id_idx on public.archived_budgets(user_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists reports_cache_user_id_idx on public.reports_cache(user_id);
create index if not exists uploaded_files_user_id_idx on public.uploaded_files(user_id);

create index if not exists transactions_user_year_month_idx on public.transactions(user_id, year, month);
create index if not exists transactions_user_type_idx on public.transactions(user_id, type);
create index if not exists expected_transactions_user_year_month_idx on public.expected_transactions(user_id, year, month);
create index if not exists expected_transactions_user_type_idx on public.expected_transactions(user_id, type);
create index if not exists categories_user_type_idx on public.categories(user_id, type);
create index if not exists payment_methods_user_active_idx on public.payment_methods(user_id, is_active);
create index if not exists budget_snapshots_user_year_month_idx on public.budget_snapshots(user_id, year, month);
create index if not exists archived_budgets_user_year_idx on public.archived_budgets(user_id, year);
create index if not exists notifications_user_read_idx on public.notifications(user_id, is_read);
create index if not exists uploaded_files_user_entity_idx on public.uploaded_files(user_id, related_entity_type, related_entity_id);
