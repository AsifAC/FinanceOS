-- Account-owned immutable-at-capture budget summaries. The JSONB payload keeps
-- the existing monthly/yearly archive semantics intact; period fields support
-- filtering without unpacking summary data.
create table public.budget_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_scope text not null,
  snapshot_year integer not null,
  snapshot_month integer,
  snapshot_version integer not null default 2,
  actual_source text not null default 'supabase',
  expected_source text not null default 'local',
  summary jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_snapshots_scope_check check (snapshot_scope in ('month', 'year')),
  constraint budget_snapshots_period_check check (
    (snapshot_scope = 'month' and snapshot_month between 0 and 11)
    or (snapshot_scope = 'year' and snapshot_month is null)
  ),
  constraint budget_snapshots_year_check check (snapshot_year between 1 and 9999),
  constraint budget_snapshots_version_check check (snapshot_version > 0),
  constraint budget_snapshots_actual_source_check check (actual_source in ('supabase', 'legacy')),
  constraint budget_snapshots_expected_source_check check (expected_source = 'local'),
  constraint budget_snapshots_summary_object_check check (jsonb_typeof(summary) = 'object')
);

create index budget_snapshots_owner_period_idx
  on public.budget_snapshots (user_id, snapshot_year desc, snapshot_month, created_at desc);

create trigger budget_snapshots_set_updated_at
before update on public.budget_snapshots
for each row execute function public.set_updated_at();

alter table public.budget_snapshots enable row level security;

create policy "Users can select their own budget snapshots"
on public.budget_snapshots for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own budget snapshots"
on public.budget_snapshots for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own budget snapshots"
on public.budget_snapshots for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own budget snapshots"
on public.budget_snapshots for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.budget_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.budget_snapshots to authenticated;
