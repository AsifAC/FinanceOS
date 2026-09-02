create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  display_name text,
  avatar_url text,
  timezone text default 'America/New_York',
  currency text default 'USD',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint profiles_currency_length check (char_length(currency) = 3)
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  theme text default 'dark',
  accent_color text default 'lime',
  default_view text default 'dashboard',
  week_starts_on text default 'monday',
  month_start_day integer default 1,
  number_format text default 'en-US',
  currency text default 'USD',
  timezone text default 'America/New_York',
  preview_mode_enabled boolean default true,
  notifications_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint user_preferences_theme_check check (theme in ('dark', 'light', 'system')),
  constraint user_preferences_default_view_check check (default_view in ('dashboard', 'reports', 'transactions', 'savings', 'debt')),
  constraint user_preferences_week_starts_on_check check (week_starts_on in ('monday', 'sunday')),
  constraint user_preferences_month_start_day_check check (month_start_day between 1 and 28),
  constraint user_preferences_currency_length check (char_length(currency) = 3)
);

create index profiles_id_idx on public.profiles (id);
create index user_preferences_user_id_idx on public.user_preferences (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

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

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

create policy "Users can select their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can select their own preferences"
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update their own preferences"
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select on table public.profiles to authenticated;
grant update (
  email,
  full_name,
  display_name,
  avatar_url,
  timezone,
  currency,
  onboarding_completed
) on table public.profiles to authenticated;

grant select on table public.user_preferences to authenticated;
grant update (
  theme,
  accent_color,
  default_view,
  week_starts_on,
  month_start_day,
  number_format,
  currency,
  timezone,
  preview_mode_enabled,
  notifications_enabled
) on table public.user_preferences to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
