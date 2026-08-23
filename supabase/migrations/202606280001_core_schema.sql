-- FinanceOS core Supabase schema.
-- Review before applying. This migration is additive and does not drop data.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  full_name text,
  avatar_url text,
  currency text default 'USD',
  timezone text default 'America/New_York',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  theme text default 'dark',
  start_day_of_week text default 'sunday',
  preview_mode boolean default false,
  dashboard_layout jsonb default '{}'::jsonb,
  notification_settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense', 'savings', 'debt')),
  color text,
  icon text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null,
  institution_name text,
  last4 text,
  network text,
  color text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  type text not null check (type in ('income', 'expense', 'savings', 'debt')),
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  transaction_date date not null,
  month int not null check (month between 1 and 12),
  year int not null,
  notes text,
  is_recurring boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.expected_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  type text not null check (type in ('income', 'expense', 'savings', 'debt')),
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  expected_date date,
  month int not null check (month between 1 and 12),
  year int not null,
  status text default 'planned',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount >= 0),
  current_amount numeric(12, 2) default 0 check (current_amount >= 0),
  target_date date,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  savings_goal_id uuid references public.savings_goals(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  contribution_date date not null,
  month int not null check (month between 1 and 12),
  year int not null,
  created_at timestamptz default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  lender text,
  original_balance numeric(12, 2) check (original_balance >= 0),
  current_balance numeric(12, 2) not null check (current_balance >= 0),
  minimum_payment numeric(12, 2) default 0 check (minimum_payment >= 0),
  interest_rate numeric(6, 3),
  due_day int check (due_day between 1 and 31),
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  debt_id uuid references public.debts(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_date date not null,
  month int not null check (month between 1 and 12),
  year int not null,
  created_at timestamptz default now()
);

create table if not exists public.budget_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month int check (month between 1 and 12),
  year int not null,
  snapshot_type text not null check (snapshot_type in ('monthly', 'annual')),
  total_income numeric(12, 2) default 0,
  total_expenses numeric(12, 2) default 0,
  total_savings numeric(12, 2) default 0,
  total_debt numeric(12, 2) default 0,
  amount_left numeric(12, 2) default 0,
  budget_health_score numeric(5, 2),
  snapshot_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.archived_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  year int not null,
  archive_type text default 'annual',
  title text not null,
  annual_report_data jsonb default '{}'::jsonb,
  pdf_url text,
  archived_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text default 'info',
  is_read boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.reports_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month int check (month between 1 and 12),
  year int not null,
  report_type text not null,
  report_data jsonb default '{}'::jsonb,
  generated_at timestamptz default now()
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  related_entity_id uuid,
  related_entity_type text,
  bucket_name text not null,
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger expected_transactions_set_updated_at
  before update on public.expected_transactions
  for each row execute function public.set_updated_at();

create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

create trigger archived_budgets_set_updated_at
  before update on public.archived_budgets
  for each row execute function public.set_updated_at();
