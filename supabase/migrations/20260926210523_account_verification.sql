-- Local proposal only. No existing users are backfilled.
begin;
alter table public.profiles
  add column phone_number text,
  add column verification_channel text,
  add column account_verified_at timestamptz,
  add column phone_verified_at timestamptz,
  add constraint profiles_phone_e164 check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint profiles_verification_channel check (verification_channel is null or verification_channel in ('email', 'phone'));

-- Table-level UPDATE overrides column grants. Remove it before restricting writes.
-- Existing owner SELECT/UPDATE RLS policies are retained unchanged.
revoke insert, update on public.profiles from public, anon, authenticated;
grant update (email, full_name, display_name, avatar_url, timezone, currency,
  onboarding_completed, verification_channel) on public.profiles to authenticated;

-- Only trusted Auth confirmation evidence may set verification timestamps/phone.
-- A private definer is necessary to read auth.users; no client has access to that table.
create schema if not exists financeos_private;
revoke all on schema financeos_private from public, anon;
grant usage on schema financeos_private to authenticated;
create function financeos_private.complete_account_verification(channel text)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  identity_row auth.users%rowtype;
  result public.profiles;
begin
  if owner_id is null or channel is null or channel not in ('email', 'phone') then
    raise exception 'Verification requires an authenticated owner and valid channel' using errcode = '42501';
  end if;
  select * into identity_row from auth.users where id = owner_id;
  if not found then raise exception 'Account unavailable' using errcode = '42501'; end if;
  if channel = 'email' then
    if identity_row.email_confirmed_at is null or not exists (
      select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) evidence
      where evidence->>'method' = 'otp'
        and (evidence->>'timestamp')::numeric between extract(epoch from now() - interval '10 minutes') and extract(epoch from now())
    ) then
      raise exception 'A recent Auth OTP confirmation is required' using errcode = '42501';
    end if;
    update public.profiles set verification_channel = 'email', account_verified_at = coalesce(account_verified_at, now())
      where id = owner_id returning * into result;
  else
    if identity_row.phone_confirmed_at is null
      or identity_row.phone_confirmed_at < now() - interval '10 minutes'
      or identity_row.phone is null or identity_row.phone !~ '^\+?[1-9][0-9]{7,14}$'
      or coalesce(identity_row.phone_change, '') <> '' then
      raise exception 'A recent Auth phone confirmation is required' using errcode = '42501';
    end if;
    update public.profiles set phone_number = '+' || ltrim(identity_row.phone, '+'),
      verification_channel = 'phone', phone_verified_at = identity_row.phone_confirmed_at,
      account_verified_at = coalesce(account_verified_at, now())
      where id = owner_id returning * into result;
  end if;
  if result.id is null then raise exception 'Profile unavailable' using errcode = 'P0002'; end if;
  return result;
end;
$$;
revoke all on function financeos_private.complete_account_verification(text) from public, anon;
grant execute on function financeos_private.complete_account_verification(text) to authenticated;

-- Public wrapper uses caller privileges; implementation schema must remain unexposed.
create function public.complete_account_verification(channel text)
returns public.profiles language sql security invoker set search_path = ''
as $$ select financeos_private.complete_account_verification(channel); $$;
revoke all on function public.complete_account_verification(text) from public, anon;
grant execute on function public.complete_account_verification(text) to authenticated;
commit;
