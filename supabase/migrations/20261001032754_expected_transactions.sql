-- One row represents one dated planned financial event. Budget targets and
-- recurrence definitions remain separate models.
-- These unique keys let composite foreign keys enforce owner and type together.
alter table public.categories
  add constraint categories_user_id_id_type_key unique (user_id, id, type);

alter table public.transactions
  add constraint transactions_user_id_id_key unique (user_id, id);

create table public.expected_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(14, 2) not null,
  type text not null,
  expected_date date not null,
  category_id uuid,
  payment_method_id uuid,
  notes text,
  status text not null default 'planned',
  actual_transaction_id uuid unique,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expected_transactions_title_not_blank check (length(btrim(title)) > 0),
  -- Numeric NaN compares greater than finite numbers in PostgreSQL, so the
  -- upper bound also rejects NaN and positive Infinity.
  constraint expected_transactions_amount_positive_finite check (
    amount > 0 and amount < 'Infinity'::numeric
  ),
  constraint expected_transactions_type_check check (
    type in ('income', 'expense', 'savings', 'debt')
  ),
  constraint expected_transactions_status_check check (
    status in ('planned', 'completed', 'cancelled')
  ),
  constraint expected_transactions_completion_consistent check (
    (status = 'completed' and actual_transaction_id is not null and completed_at is not null)
    or (status in ('planned', 'cancelled') and actual_transaction_id is null and completed_at is null)
  ),
  constraint expected_transactions_category_owner_type_fk foreign key (user_id, category_id, type)
    references public.categories (user_id, id, type) on delete restrict,
  constraint expected_transactions_payment_method_owner_fk foreign key (user_id, payment_method_id)
    references public.payment_methods (user_id, id) on delete restrict,
  constraint expected_transactions_actual_owner_fk foreign key (user_id, actual_transaction_id)
    references public.transactions (user_id, id) on delete restrict
);

create index expected_transactions_user_date_idx
  on public.expected_transactions (user_id, expected_date);

create index expected_transactions_user_status_date_idx
  on public.expected_transactions (user_id, status, expected_date);

create index expected_transactions_category_owner_idx
  on public.expected_transactions (user_id, category_id)
  where category_id is not null;

create index expected_transactions_payment_method_owner_idx
  on public.expected_transactions (user_id, payment_method_id)
  where payment_method_id is not null;

create index expected_transactions_actual_owner_idx
  on public.expected_transactions (user_id, actual_transaction_id)
  where actual_transaction_id is not null;

create trigger expected_transactions_set_updated_at
before update on public.expected_transactions
for each row execute function public.set_updated_at();

alter table public.expected_transactions enable row level security;

create policy "Users can select their own expected transactions"
on public.expected_transactions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own expected transactions"
on public.expected_transactions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own expected transactions"
on public.expected_transactions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own expected transactions"
on public.expected_transactions for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.expected_transactions from public, anon, authenticated;
grant select, insert, update, delete on table public.expected_transactions to authenticated;
