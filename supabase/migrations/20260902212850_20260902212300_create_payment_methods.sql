create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  type text not null,
  institution_name text,
  last4 text,
  network text,
  color_theme text,
  is_default boolean default false,
  is_archived boolean default false,
  is_linked boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint payment_methods_type_check check (
    type in (
      'cash',
      'checking',
      'savings',
      'credit_card',
      'debit_card',
      'loan',
      'investment',
      'digital_wallet',
      'other'
    )
  ),
  constraint payment_methods_nickname_not_blank check (length(btrim(nickname)) > 0),
  constraint payment_methods_last4_check check (last4 is null or last4 ~ '^[0-9]{4}$'),
  constraint payment_methods_color_theme_check check (
    color_theme is null
    or color_theme ~ '^#[0-9A-Fa-f]{6}$'
    or color_theme ~ '^[A-Za-z][A-Za-z0-9_-]{0,31}$'
  ),
  constraint payment_methods_user_nickname_key unique (user_id, nickname)
);

create index payment_methods_user_id_idx on public.payment_methods (user_id);
create index payment_methods_user_type_idx on public.payment_methods (user_id, type);
create index payment_methods_user_archived_idx on public.payment_methods (user_id, is_archived);

create unique index payment_methods_one_default_per_user_idx
on public.payment_methods (user_id)
where is_default = true and is_archived = false;

create trigger payment_methods_set_updated_at
before update on public.payment_methods
for each row
execute function public.set_updated_at();

alter table public.payment_methods enable row level security;

create policy "Users can select their own payment methods"
on public.payment_methods
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own payment methods"
on public.payment_methods
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own payment methods"
on public.payment_methods
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own payment methods"
on public.payment_methods
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.payment_methods to authenticated;

create or replace function public.set_default_payment_method(target_payment_method_id uuid)
returns public.payment_methods
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_payment_method public.payment_methods;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to set a default payment method.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.payment_methods
    where id = target_payment_method_id
      and user_id = current_user_id
      and is_archived = false
  ) then
    raise exception 'Payment method was not found or is archived.'
      using errcode = 'P0002';
  end if;

  update public.payment_methods
  set is_default = false
  where user_id = current_user_id
    and is_default = true
    and is_archived = false;

  update public.payment_methods
  set is_default = true
  where id = target_payment_method_id
    and user_id = current_user_id
    and is_archived = false
  returning * into updated_payment_method;

  return updated_payment_method;
end;
$$;

revoke execute on function public.set_default_payment_method(uuid) from public, anon;
grant execute on function public.set_default_payment_method(uuid) to authenticated;
