create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  icon text,
  color text,
  sort_order integer default 0,
  is_default boolean default false,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint categories_type_check check (type in ('income', 'expense', 'savings', 'debt')),
  constraint categories_name_not_blank check (length(btrim(name)) > 0),
  constraint categories_color_hex_check check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint categories_user_type_name_key unique (user_id, type, name)
);

create index categories_user_id_idx on public.categories (user_id);
create index categories_user_type_idx on public.categories (user_id, type);
create index categories_user_archived_idx on public.categories (user_id, is_archived);

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "Users can select their own categories"
on public.categories
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own categories"
on public.categories
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own categories"
on public.categories
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own categories"
on public.categories
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.categories to authenticated;

create or replace function public.create_default_categories_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (
    user_id,
    name,
    type,
    icon,
    color,
    sort_order,
    is_default
  )
  values
    (target_user_id, 'Salary', 'income', '$', '#00D68F', 10, true),
    (target_user_id, 'Bonus', 'income', '+', '#22C55E', 20, true),
    (target_user_id, 'Freelance', 'income', 'F', '#10B981', 30, true),
    (target_user_id, 'Refunds', 'income', 'R', '#84CC16', 40, true),
    (target_user_id, 'Other Income', 'income', 'O', '#65A30D', 50, true),

    (target_user_id, 'Housing', 'expense', 'H', '#EF4444', 10, true),
    (target_user_id, 'Utilities', 'expense', 'U', '#F97316', 20, true),
    (target_user_id, 'Groceries', 'expense', 'G', '#FB923C', 30, true),
    (target_user_id, 'Dining', 'expense', 'D', '#FDBA74', 40, true),
    (target_user_id, 'Transportation', 'expense', 'T', '#F59E0B', 50, true),
    (target_user_id, 'Insurance', 'expense', 'I', '#F43F5E', 60, true),
    (target_user_id, 'Healthcare', 'expense', '+', '#14B8A6', 70, true),
    (target_user_id, 'Subscriptions', 'expense', 'S', '#FB7185', 80, true),
    (target_user_id, 'Shopping', 'expense', 'S', '#EC4899', 90, true),
    (target_user_id, 'Entertainment', 'expense', 'E', '#A855F7', 100, true),
    (target_user_id, 'Education', 'expense', 'E', '#6366F1', 110, true),
    (target_user_id, 'Travel', 'expense', 'T', '#38BDF8', 120, true),
    (target_user_id, 'Other Expense', 'expense', 'O', '#94A3B8', 130, true),

    (target_user_id, 'Emergency Fund', 'savings', 'E', '#3B82F6', 10, true),
    (target_user_id, 'Investments', 'savings', 'I', '#2563EB', 20, true),
    (target_user_id, 'Vacation', 'savings', 'V', '#38BDF8', 30, true),
    (target_user_id, 'Car', 'savings', 'C', '#06B6D4', 40, true),
    (target_user_id, 'House', 'savings', 'H', '#8B5CF6', 50, true),
    (target_user_id, 'Other Savings', 'savings', 'O', '#6366F1', 60, true),

    (target_user_id, 'Credit Card', 'debt', 'C', '#FBBF24', 10, true),
    (target_user_id, 'Student Loan', 'debt', 'S', '#F59E0B', 20, true),
    (target_user_id, 'Auto Loan', 'debt', 'A', '#D97706', 30, true),
    (target_user_id, 'Personal Loan', 'debt', 'P', '#B45309', 40, true),
    (target_user_id, 'Mortgage', 'debt', 'M', '#92400E', 50, true),
    (target_user_id, 'Other Debt', 'debt', 'O', '#A16207', 60, true)
  on conflict (user_id, type, name) do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_full_name text;
  profile_display_name text;
begin
  profile_full_name := coalesce(
    nullif(metadata ->> 'full_name', ''),
    nullif(metadata ->> 'name', ''),
    nullif(new.email, ''),
    'FinanceOS User'
  );

  profile_display_name := coalesce(
    nullif(metadata ->> 'display_name', ''),
    profile_full_name
  );

  insert into public.profiles (
    id,
    email,
    full_name,
    display_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    profile_full_name,
    profile_display_name,
    nullif(metadata ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  perform public.create_default_categories_for_user(new.id);

  return new;
end;
$$;

revoke execute on function public.create_default_categories_for_user(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
