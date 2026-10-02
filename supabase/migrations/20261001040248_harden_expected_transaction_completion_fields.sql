-- Authenticated browser clients can manage planned/cancelled events, but the
-- actual-transaction link and completion timestamp are reserved for the future
-- atomic conversion RPC. INSERT status is omitted so new rows use the planned
-- database default.
alter table public.expected_transactions
  alter column user_id set default auth.uid();

revoke insert, update on table public.expected_transactions from authenticated;

grant insert (
  title,
  amount,
  type,
  expected_date,
  category_id,
  payment_method_id,
  notes
) on public.expected_transactions to authenticated;

grant update (
  title,
  amount,
  type,
  expected_date,
  category_id,
  payment_method_id,
  notes,
  status
) on public.expected_transactions to authenticated;

drop policy "Users can update their own expected transactions"
  on public.expected_transactions;
create policy "Users can update their own planned expected transactions"
on public.expected_transactions for update to authenticated
using ((select auth.uid()) = user_id and status <> 'completed')
with check ((select auth.uid()) = user_id);

drop policy "Users can delete their own expected transactions"
  on public.expected_transactions;
create policy "Users can delete their own non-completed expected transactions"
on public.expected_transactions for delete to authenticated
using ((select auth.uid()) = user_id and status <> 'completed');
