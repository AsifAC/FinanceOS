-- LOCAL ONLY until reviewed and deployed separately. No browser completion grants.
create schema if not exists private;

create function private.complete_expected_transaction(
  p_expected_transaction_id uuid, p_title text, p_amount numeric,
  p_transaction_date date, p_category_id uuid, p_payment_method_id uuid, p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_expected public.expected_transactions%rowtype;
  v_actual public.transactions%rowtype;
begin
  if v_owner is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  select * into v_expected from public.expected_transactions
    where id = p_expected_transaction_id and user_id = v_owner for update;
  if not found then
    raise exception 'Expected event unavailable.' using errcode = 'P0002';
  end if;
  -- Recheck state after the lock, including when another caller just committed.
  if v_expected.status = 'completed' then
    select * into strict v_actual from public.transactions
      where id = v_expected.actual_transaction_id and user_id = v_owner;
    return jsonb_build_object('expected_transaction', to_jsonb(v_expected),
      'actual_transaction', to_jsonb(v_actual), 'already_completed', true);
  end if;
  if v_expected.status <> 'planned' then
    raise exception 'Reopen cancelled events before completion.' using errcode = 'P0001';
  end if;
  if p_title is null or length(btrim(p_title)) = 0
    or p_amount is null or not (p_amount > 0 and p_amount <= 999999999999.99)
    or p_amount <> round(p_amount, 2)
    or p_transaction_date is null or not isfinite(p_transaction_date)
    or p_transaction_date < date '0001-01-01' or p_transaction_date > date '9999-12-31' then
    raise exception 'Invalid actual fields.' using errcode = '22023';
  end if;
  -- Lock metadata against archive/type/ownership changes until commit.
  if p_category_id is not null then
    perform 1 from public.categories where id = p_category_id and user_id = v_owner
      and type = v_expected.type and not coalesce(is_archived, false) for share;
    if not found then
      raise exception 'Choose an active owned category of the event type.' using errcode = '22023';
    end if;
  end if;
  if p_payment_method_id is not null then
    perform 1 from public.payment_methods where id = p_payment_method_id and user_id = v_owner
      and not coalesce(is_archived, false) for share;
    if not found then
      raise exception 'Choose an active owned payment method.' using errcode = '22023';
    end if;
  end if;
  insert into public.transactions (user_id, title, amount, type, transaction_date,
    category_id, payment_method_id, notes, source)
    values (v_owner, btrim(p_title), p_amount, v_expected.type, p_transaction_date,
      p_category_id, p_payment_method_id, p_notes, 'manual') returning * into v_actual;
  update public.expected_transactions set status = 'completed',
    actual_transaction_id = v_actual.id, completed_at = now()
    where id = v_expected.id and user_id = v_owner returning * into v_expected;
  return jsonb_build_object('expected_transaction', to_jsonb(v_expected),
    'actual_transaction', to_jsonb(v_actual), 'already_completed', false);
end;
$$;

-- The Data API exposes only this invoker wrapper. The private implementation
-- needs definer rights because completion columns are intentionally protected.
create function public.complete_expected_transaction(
  p_expected_transaction_id uuid, p_title text, p_amount numeric,
  p_transaction_date date, p_category_id uuid, p_payment_method_id uuid, p_notes text
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select private.complete_expected_transaction(p_expected_transaction_id, p_title,
    p_amount, p_transaction_date, p_category_id, p_payment_method_id, p_notes);
$$;

revoke all on function private.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text) to authenticated;
grant execute on function public.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text) to authenticated;
