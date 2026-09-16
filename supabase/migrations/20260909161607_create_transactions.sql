alter table public.categories
add constraint categories_user_id_id_key unique (user_id, id);

alter table public.payment_methods
add constraint payment_methods_user_id_id_key unique (user_id, id);

-- LOCAL ONLY: actual records, never pending obligations or preview data.
-- Composite FKs additionally protect ownership during concurrent parent updates.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(14, 2) not null,
  type text not null,
  transaction_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  description text,
  notes text,
  is_recurring boolean not null default false,
  recurring_group_id uuid,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_title_not_blank check (length(btrim(title)) > 0),
  constraint transactions_amount_positive check (amount > 0 and amount <> 'NaN'::numeric),
  constraint transactions_type_check check (
    type in ('income', 'expense', 'savings', 'debt')
  ),
  constraint transactions_source_check check (
    source in ('manual', 'recurring', 'import', 'migration')
  ),
  constraint transactions_category_owner_fk foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on delete set null (category_id),
  constraint transactions_payment_method_owner_fk foreign key (user_id, payment_method_id)
    references public.payment_methods (user_id, id)
    on delete set null (payment_method_id)
);

create index transactions_user_date_idx
on public.transactions (user_id, transaction_date desc);

create index transactions_user_type_idx on public.transactions (user_id, type);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_payment_method_idx on public.transactions (payment_method_id);

create function public.validate_transaction_ownership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories
    where id = new.category_id and user_id = new.user_id
  ) then
    raise exception 'Transaction category must exist and belong to the transaction owner.'
      using errcode = '23514';
  end if;

  if new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods
    where id = new.payment_method_id and user_id = new.user_id
  ) then
    raise exception 'Transaction payment method must exist and belong to the transaction owner.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Trigger-only helper, not a client RPC.
revoke execute on function public.validate_transaction_ownership() from public, anon, authenticated;

create trigger transactions_validate_ownership
before insert or update on public.transactions
for each row execute function public.validate_transaction_ownership();

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy "Users can select their own transactions"
on public.transactions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own transactions"
on public.transactions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own transactions"
on public.transactions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own transactions"
on public.transactions
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.transactions from public, anon, authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
