begin;

select plan(27);

select has_table('public', 'budget_snapshots', 'budget snapshots table exists');
select col_type_is('public', 'budget_snapshots', 'summary', 'jsonb', 'summary is JSONB');
select col_type_is('public', 'budget_snapshots', 'user_id', 'uuid', 'owner is a UUID');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.budget_snapshots'::regclass),
  'row level security is enabled'
);
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public' and tablename = 'budget_snapshots'),
  4,
  'four owner-scoped CRUD policies exist'
);
select ok(
  has_table_privilege('authenticated', 'public.budget_snapshots', 'SELECT')
  and has_table_privilege('authenticated', 'public.budget_snapshots', 'INSERT')
  and has_table_privilege('authenticated', 'public.budget_snapshots', 'UPDATE')
  and has_table_privilege('authenticated', 'public.budget_snapshots', 'DELETE'),
  'authenticated role has CRUD grants'
);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'snapshot-a@example.test', '', '{}', '{}'),
  ('b2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'snapshot-b@example.test', '', '{}', '{}');

insert into public.budget_snapshots (id, user_id, snapshot_scope, snapshot_year, snapshot_month, summary)
values
  ('c3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'month', 2026, 0,
   '{"income": {"actual": 1200, "expected": 1500}, "yearly": {"net": 1200}, "rates": {"savings": 0.2}, "categories": [{"id":"cat-uuid","amount":50}], "months": [{"month":0,"expense":25}], "transaction_count":2,"pending_count":1,"snapshotVersion":2,"actualSource":"supabase","expectedSource":"local","notes":"captured"}'),
  ('d4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222', 'year', 2026, null,
   '{"income": {"actual": 900}, "transaction_count":1,"notes":"account B"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

select is((select count(*)::integer from public.budget_snapshots), 1, 'Account A sees only its row');
select is((select summary #>> '{income,expected}' from public.budget_snapshots), '1500', 'JSONB summary values round-trip');
select lives_ok(
  $$insert into public.budget_snapshots (user_id, snapshot_scope, snapshot_year, snapshot_month, summary)
    values ('a1111111-1111-4111-8111-111111111111', 'month', 2026, 11, '{"transaction_count":0}')$$,
  'Account A can create its own snapshot'
);
select lives_ok(
  $$insert into public.budget_snapshots (user_id, snapshot_scope, snapshot_year, snapshot_month, summary)
    values ('a1111111-1111-4111-8111-111111111111', 'month', 2026, 0, '{"transaction_count":3}')$$,
  'same-period snapshots can be saved as separate versions'
);
select lives_ok(
  $$insert into public.budget_snapshots (user_id, snapshot_scope, snapshot_year, snapshot_month, summary)
    values ('a1111111-1111-4111-8111-111111111111', 'year', 2026, null, '{"transaction_count":3}')$$,
  'yearly snapshots accept a null month'
);
select throws_ok(
  $$insert into public.budget_snapshots (user_id, snapshot_scope, snapshot_year, snapshot_month, summary)
    values ('a1111111-1111-4111-8111-111111111111', 'month', 2026, -1, '{}')$$,
  '23514', null, 'month -1 is rejected'
);
select throws_ok(
  $$insert into public.budget_snapshots (user_id, snapshot_scope, snapshot_year, snapshot_month, summary)
    values ('a1111111-1111-4111-8111-111111111111', 'month', 2026, 12, '{}')$$,
  '23514', null, 'month 12 is rejected'
);
select throws_ok(
  $$insert into public.budget_snapshots (user_id, snapshot_scope, snapshot_year, snapshot_month, summary)
    values ('a1111111-1111-4111-8111-111111111111', 'quarter', 2026, null, '{}')$$,
  '23514', null, 'unsupported scope is rejected'
);
select throws_ok(
  $$insert into public.budget_snapshots (user_id, snapshot_scope, snapshot_year, snapshot_month, summary)
    values ('b2222222-2222-4222-8222-222222222222', 'month', 2026, 1, '{}')$$,
  '42501', null, 'owner spoofing is rejected by RLS'
);
select is((select count(*)::integer from public.budget_snapshots where id = 'd4444444-4444-4444-8444-444444444444'), 0, 'Account A cannot select Account B row');
select lives_ok(
  $$update public.budget_snapshots set summary = jsonb_set(summary, '{notes}', '"A updated"') where id = 'c3333333-3333-4333-8333-333333333333'$$,
  'Account A can update its own snapshot and notes'
);
select lives_ok(
  $$update public.budget_snapshots set summary = '{"notes":"cross-owner overwrite"}' where id = 'd4444444-4444-4444-8444-444444444444'$$,
  'cross-owner update affects zero visible rows without error'
);
select lives_ok(
  $$delete from public.budget_snapshots where id = 'd4444444-4444-4444-8444-444444444444'$$,
  'cross-owner delete affects zero visible rows without error'
);

reset role;

select is((select summary->>'notes' from public.budget_snapshots where id = 'c3333333-3333-4333-8333-333333333333'), 'A updated', 'owner update persisted');
select is((select summary->>'notes' from public.budget_snapshots where id = 'd4444444-4444-4444-8444-444444444444'), 'account B', 'cross-owner update and delete left B row unchanged');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
select is((select count(*)::integer from public.budget_snapshots), 1, 'Account B sees only its row');
select lives_ok(
  $$update public.budget_snapshots set summary = jsonb_set(summary, '{notes}', '"B updated"') where id = 'd4444444-4444-4444-8444-444444444444'$$,
  'Account B can update its own snapshot and notes'
);
select lives_ok(
  $$delete from public.budget_snapshots where id = 'd4444444-4444-4444-8444-444444444444'$$,
  'Account B can delete its own snapshot'
);

reset role;
select is((select count(*)::integer from public.budget_snapshots where id = 'd4444444-4444-4444-8444-444444444444'), 0, 'Account B delete persisted');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$delete from public.budget_snapshots where id = 'c3333333-3333-4333-8333-333333333333'$$,
  'Account A can delete its own snapshot'
);
reset role;
select is((select count(*)::integer from public.budget_snapshots where id = 'c3333333-3333-4333-8333-333333333333'), 0, 'Account A delete persisted');

rollback;
