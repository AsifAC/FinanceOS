begin;

select plan(88);

select has_table('public', 'expected_transactions', 'expected transactions table exists');
select col_type_is('public', 'expected_transactions', 'id', 'uuid', 'id is UUID');
select col_type_is('public', 'expected_transactions', 'user_id', 'uuid', 'owner is UUID');
select col_type_is('public', 'expected_transactions', 'amount', 'numeric(14,2)', 'amount uses actual transaction precision');
select col_type_is('public', 'expected_transactions', 'expected_date', 'date', 'expected date is a calendar date');
select col_type_is('public', 'expected_transactions', 'completed_at', 'timestamp with time zone', 'completion time is timestamptz');
select ok((select exists (select 1 from pg_constraint where conrelid = 'public.expected_transactions'::regclass and contype = 'p')), 'primary key exists');
select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'expected_transactions' and column_name = 'status'), '''planned''::text', 'status defaults to planned');
select ok((select count(*) = 14 from information_schema.columns where table_schema = 'public' and table_name = 'expected_transactions' and column_name in ('id','user_id','title','amount','type','expected_date','category_id','payment_method_id','notes','status','actual_transaction_id','completed_at','created_at','updated_at')), 'all contract columns exist');
select ok((select column_default like '%gen_random_uuid%' from information_schema.columns where table_schema = 'public' and table_name = 'expected_transactions' and column_name = 'id'), 'id defaults to a generated UUID');
select ok((select column_default is not null from information_schema.columns where table_schema = 'public' and table_name = 'expected_transactions' and column_name = 'created_at') and (select column_default is not null from information_schema.columns where table_schema = 'public' and table_name = 'expected_transactions' and column_name = 'updated_at'), 'timestamps have server defaults');
select ok((select exists (select 1 from pg_constraint where conrelid = 'public.expected_transactions'::regclass and conname = 'expected_transactions_user_id_fkey' and confrelid = 'auth.users'::regclass)), 'user owner references auth.users');
select ok((select exists (select 1 from pg_constraint where conrelid = 'public.expected_transactions'::regclass and conname = 'expected_transactions_actual_transaction_id_key' and contype = 'u')), 'actual transaction link is unique');
select is((select count(*)::integer from pg_indexes where schemaname = 'public' and tablename = 'expected_transactions' and indexname in ('expected_transactions_user_date_idx','expected_transactions_user_status_date_idx','expected_transactions_category_owner_idx','expected_transactions_payment_method_owner_idx','expected_transactions_actual_owner_idx')), 5, 'owner/date and foreign-key indexes exist');
select ok((select relrowsecurity from pg_class where oid = 'public.expected_transactions'::regclass), 'RLS is enabled');
select ok((select exists (select 1 from pg_trigger where tgrelid = 'public.expected_transactions'::regclass and tgname = 'expected_transactions_set_updated_at' and not tgisinternal)), 'updated_at trigger exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'expected_transactions'), 4, 'four owner-scoped CRUD policies exist');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'expected_transactions' and (coalesce(qual, '') || coalesce(with_check, '')) like '%auth.uid()%'), 4, 'all CRUD policies enforce auth.uid ownership');
select ok(
  has_table_privilege('authenticated', 'public.expected_transactions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.expected_transactions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.expected_transactions', 'UPDATE')
  and has_table_privilege('authenticated', 'public.expected_transactions', 'DELETE'),
  'authenticated has table SELECT and DELETE grants but no table-wide INSERT/UPDATE'
);
select ok(
  not has_table_privilege('anon', 'public.expected_transactions', 'SELECT')
  and not has_table_privilege('anon', 'public.expected_transactions', 'INSERT')
  and not has_table_privilege('anon', 'public.expected_transactions', 'UPDATE')
  and not has_table_privilege('anon', 'public.expected_transactions', 'DELETE'),
  'anon has no expected transaction grants'
);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'expected-a@example.test', '', '{}', '{}'),
  ('b2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'expected-b@example.test', '', '{}', '{}');

insert into public.categories (id, user_id, name, type)
values
  ('a3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'Test Expense', 'expense'),
  ('a4444444-4444-4444-8444-444444444444', 'a1111111-1111-4111-8111-111111111111', 'Test Income', 'income'),
  ('b3333333-3333-4333-8333-333333333333', 'b2222222-2222-4222-8222-222222222222', 'B Expense', 'expense');

insert into public.payment_methods (id, user_id, nickname, type)
values
  ('a5555555-5555-4555-8555-555555555555', 'a1111111-1111-4111-8111-111111111111', 'A Checking', 'checking'),
  ('b5555555-5555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'B Checking', 'checking');

insert into public.transactions (id, user_id, title, amount, type, transaction_date)
values
  ('a6666666-6666-4666-8666-666666666666', 'a1111111-1111-4111-8111-111111111111', 'A actual', 10, 'expense', '2026-10-01'),
  ('b6666666-6666-4666-8666-666666666666', 'b2222222-2222-4222-8222-222222222222', 'B actual', 10, 'expense', '2026-10-01');

-- Privileged fixture setup represents completion performed by the future RPC;
-- normal authenticated clients are tested below and cannot create this state.
insert into public.expected_transactions (id, user_id, title, amount, type, expected_date, notes, status, actual_transaction_id, completed_at)
values ('a7777777-7777-4777-8777-777777777776', 'a1111111-1111-4111-8111-111111111111', 'Valid completion', 1, 'expense', '2026-10-01', 'original completed notes', 'completed', 'a6666666-6666-4666-8666-666666666666', now());
select throws_ok($$insert into public.expected_transactions (user_id, title, amount, type, expected_date, status, actual_transaction_id, completed_at) values ('a1111111-1111-4111-8111-111111111111', 'Duplicate actual', 1, 'expense', '2026-10-01', 'completed', 'a6666666-6666-4666-8666-666666666666', now())$$, '23505', null, 'actual transaction can link only once');

insert into public.expected_transactions (id, user_id, title, amount, type, expected_date, notes)
values ('b8888888-8888-4888-8888-888888888888', 'b2222222-2222-4222-8222-222222222222', 'B private event', 8, 'expense', '2026-10-15', 'original');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date, category_id, payment_method_id) values ('Expected income', 1, 'income', '2026-10-31', 'a4444444-4444-4444-8444-444444444444', 'a5555555-5555-4555-8555-555555555555')$$, 'income expected event with same-owner references is accepted');
select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Expected expense', 2, 'expense', '2026-10-31')$$, 'expense with null references is accepted');
select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Expected savings', 3, 'savings', '2026-10-31')$$, 'savings expected event is accepted');
select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Expected debt', 4, 'debt', '2026-10-31')$$, 'debt expected event is accepted');
select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Cancelled event', 5, 'expense', '2026-10-31')$$, 'planned event can be created for cancellation test');
select lives_ok($$update public.expected_transactions set status = 'cancelled' where title = 'Cancelled event'$$, 'cancelled state is accepted without completion fields');
select is((select expected_date::text from public.expected_transactions where title = 'Expected expense'), '2026-10-31', 'SQL date round-trips without timezone conversion');
select lives_ok($$update public.expected_transactions set notes = 'edited' where title = 'Expected expense'$$, 'owner can update own expected row');
select lives_ok($$delete from public.expected_transactions where title = 'Cancelled event'$$, 'owner can delete own expected row');

select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('   ', 1, 'expense', '2026-10-01')$$, '23514', null, 'blank title is rejected');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Zero', 0, 'expense', '2026-10-01')$$, '23514', null, 'zero amount is rejected');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Negative', -1, 'expense', '2026-10-01')$$, '23514', null, 'negative amount is rejected');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('NaN', 'NaN', 'expense', '2026-10-01')$$, '23514', null, 'NaN amount is rejected');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Infinity', 'Infinity', 'expense', '2026-10-01')$$, '22003', null, 'infinite amount is rejected by numeric precision');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Invalid type', 1, 'transfer', '2026-10-01')$$, '23514', null, 'invalid type is rejected');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, status) values ('Invalid status', 1, 'expense', '2026-10-01', 'overdue')$$, '42501', null, 'normal client cannot provide insert status');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, actual_transaction_id) values ('Planned linked', 1, 'expense', '2026-10-01', 'a6666666-6666-4666-8666-666666666666')$$, '42501', null, 'normal client cannot insert an actual link');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, status, actual_transaction_id) values ('Cancelled linked', 1, 'expense', '2026-10-01', 'cancelled', 'a6666666-6666-4666-8666-666666666666')$$, '42501', null, 'normal client cannot insert status or actual link');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, status) values ('Completed without actual', 1, 'expense', '2026-10-01', 'completed')$$, '42501', null, 'normal client cannot submit completed status');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, status, actual_transaction_id) values ('Completed without time', 1, 'expense', '2026-10-01', 'completed', 'a6666666-6666-4666-8666-666666666666')$$, '42501', null, 'normal client cannot submit completion fields');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, category_id) values ('Other owner category', 1, 'expense', '2026-10-01', 'b3333333-3333-4333-8333-333333333333')$$, '23503', null, 'other-owner category is rejected');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, category_id) values ('Wrong category type', 1, 'expense', '2026-10-01', 'a4444444-4444-4444-8444-444444444444')$$, '23503', null, 'category type mismatch is rejected by composite foreign key');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, payment_method_id) values ('Other owner method', 1, 'expense', '2026-10-01', 'b5555555-5555-4555-8555-555555555555')$$, '23503', null, 'other-owner payment method is rejected');
reset role;
select throws_ok($$insert into public.expected_transactions (user_id, title, amount, type, expected_date, status, actual_transaction_id, completed_at) values ('a1111111-1111-4111-8111-111111111111', 'Other owner actual', 1, 'expense', '2026-10-01', 'completed', 'b6666666-6666-4666-8666-666666666666', now())$$, '23503', null, 'actual transaction owner foreign key rejects cross-owner link');
set local role authenticated;
select ok(
  not has_table_privilege('authenticated', 'public.expected_transactions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.expected_transactions', 'UPDATE'),
  'authenticated has no table-wide INSERT or UPDATE privilege'
);
select ok(
  has_column_privilege('authenticated', 'public.expected_transactions', 'title', 'INSERT')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'amount', 'INSERT')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'type', 'INSERT')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'expected_date', 'INSERT')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'category_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'payment_method_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'notes', 'INSERT'),
  'authenticated can insert only planned event data columns'
);
select ok(
  not has_column_privilege('authenticated', 'public.expected_transactions', 'id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.expected_transactions', 'user_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.expected_transactions', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.expected_transactions', 'actual_transaction_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.expected_transactions', 'completed_at', 'INSERT'),
  'authenticated cannot choose row identity, owner, status, or completion fields on insert'
);
select ok(
  has_column_privilege('authenticated', 'public.expected_transactions', 'title', 'UPDATE')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'amount', 'UPDATE')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'type', 'UPDATE')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'expected_date', 'UPDATE')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'category_id', 'UPDATE')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'payment_method_id', 'UPDATE')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'notes', 'UPDATE')
  and has_column_privilege('authenticated', 'public.expected_transactions', 'status', 'UPDATE'),
  'authenticated can update event data and lifecycle status'
);
select ok(
  not has_column_privilege('authenticated', 'public.expected_transactions', 'id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.expected_transactions', 'user_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.expected_transactions', 'actual_transaction_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.expected_transactions', 'completed_at', 'UPDATE'),
  'authenticated cannot update identity, owner, or completion fields'
);
select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Default planned event', 6, 'expense', '2026-11-01')$$, 'authenticated can create without supplying id, owner, status, or completion fields');
select is((select status from public.expected_transactions where title = 'Default planned event'), 'planned', 'normal client insert receives planned status by default');
select lives_ok($$delete from public.expected_transactions where title = 'Default planned event'$$, 'default-status verification row is cleaned up');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, status) values ('Direct cancelled insert', 6, 'expense', '2026-11-01', 'cancelled')$$, '42501', null, 'normal client cannot choose status during insert');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, actual_transaction_id) values ('Direct link insert', 6, 'expense', '2026-11-01', 'a6666666-6666-4666-8666-666666666666')$$, '42501', null, 'normal client cannot insert an actual transaction link');
select throws_ok($$insert into public.expected_transactions (title, amount, type, expected_date, completed_at) values ('Direct completion time insert', 6, 'expense', '2026-11-01', now())$$, '42501', null, 'normal client cannot insert completed_at');
select lives_ok($$update public.expected_transactions set title = 'Updated event', amount = 12.34, type = 'income', expected_date = '2026-11-02', category_id = 'a4444444-4444-4444-8444-444444444444', payment_method_id = 'a5555555-5555-4555-8555-555555555555', notes = 'updated fields' where title = 'Expected expense'$$, 'normal client can update allowed event fields including matching category type');
select lives_ok($$update public.expected_transactions set status = 'cancelled' where title = 'Updated event'$$, 'planned event can be cancelled');
select lives_ok($$update public.expected_transactions set status = 'planned' where title = 'Updated event'$$, 'cancelled event can be reopened as planned');
select throws_ok($$update public.expected_transactions set status = 'completed' where title = 'Updated event'$$, '23514', null, 'status alone cannot manufacture completion');
select throws_ok($$update public.expected_transactions set actual_transaction_id = 'a6666666-6666-4666-8666-666666666666' where title = 'Updated event'$$, '42501', null, 'normal client cannot update actual_transaction_id');
select throws_ok($$update public.expected_transactions set completed_at = now() where title = 'Updated event'$$, '42501', null, 'normal client cannot update completed_at');
select throws_ok($$update public.expected_transactions set status = 'completed', actual_transaction_id = 'a6666666-6666-4666-8666-666666666666', completed_at = now() where title = 'Updated event'$$, '42501', null, 'combined direct completion update is denied by column privileges');
select lives_ok($$update public.expected_transactions set notes = 'must remain original' where id = 'a7777777-7777-4777-8777-777777777776'$$, 'completed row update is filtered by RLS');
select lives_ok($$delete from public.expected_transactions where id = 'a7777777-7777-4777-8777-777777777776'$$, 'completed row deletion is filtered by RLS');
select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Delete planned', 7, 'expense', '2026-11-03')$$, 'planned deletion fixture created');
select lives_ok($$delete from public.expected_transactions where title = 'Delete planned'$$, 'planned event can be deleted');
select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('Delete cancelled', 8, 'expense', '2026-11-04')$$, 'cancelled deletion fixture starts planned');
select lives_ok($$update public.expected_transactions set status = 'cancelled' where title = 'Delete cancelled'$$, 'deletion fixture can be cancelled');
select lives_ok($$delete from public.expected_transactions where title = 'Delete cancelled'$$, 'cancelled event can be deleted');
select throws_ok($$delete from public.categories where id = 'a4444444-4444-4444-8444-444444444444'$$, '23503', null, 'referenced category cannot be hard-deleted');
select throws_ok($$delete from public.payment_methods where id = 'a5555555-5555-4555-8555-555555555555'$$, '23503', null, 'referenced payment method cannot be hard-deleted');
select throws_ok($$insert into public.expected_transactions (user_id, title, amount, type, expected_date) values ('b2222222-2222-4222-8222-222222222222', 'Spoofed owner', 1, 'expense', '2026-10-01')$$, '42501', null, 'owner spoof insert is rejected');
select is((select count(*)::integer from public.expected_transactions), 5, 'Account A sees only its five current rows');
select is((select count(*)::integer from public.expected_transactions where id = 'b8888888-8888-4888-8888-888888888888'), 0, 'Account A cannot select Account B row');
select lives_ok($$update public.expected_transactions set notes = 'cross-owner' where id = 'b8888888-8888-4888-8888-888888888888'$$, 'cross-owner update returns without exposing the row');
select lives_ok($$delete from public.expected_transactions where id = 'b8888888-8888-4888-8888-888888888888'$$, 'cross-owner delete returns without exposing the row');

reset role;
select is((select notes from public.expected_transactions where id = 'a7777777-7777-4777-8777-777777777776'), 'original completed notes', 'completed row edit attempt left stored history unchanged');
select is((select count(*)::integer from public.expected_transactions where id = 'a7777777-7777-4777-8777-777777777776'), 1, 'completed row delete attempt left linked expected history intact');
select is((select count(*)::integer from public.expected_transactions where user_id = 'a1111111-1111-4111-8111-111111111111' and notes = 'cross-owner'), 0, 'cross-owner update did not change persisted data');
select is((select count(*)::integer from public.expected_transactions where id = 'b8888888-8888-4888-8888-888888888888' and notes = 'original'), 1, 'cross-owner update and delete left Account B data intact');
select throws_ok($$delete from public.transactions where id = 'a6666666-6666-4666-8666-666666666666'$$, '23503', null, 'linked actual cannot be deleted');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
select lives_ok($$insert into public.expected_transactions (title, amount, type, expected_date) values ('B expected', 9, 'expense', '2026-10-31')$$, 'Account B can create its own event');
select is((select count(*)::integer from public.expected_transactions), 2, 'Account B sees its own rows including its private fixture');
select lives_ok($$update public.expected_transactions set notes = 'B note' where title = 'B expected'$$, 'Account B can update its own event');
select lives_ok($$delete from public.expected_transactions where title = 'B expected'$$, 'Account B can delete its own event');
select lives_ok($$delete from public.expected_transactions where id = 'b8888888-8888-4888-8888-888888888888'$$, 'Account B can delete its own fixture row');

reset role;
select is((select count(*)::integer from public.expected_transactions where user_id = 'b2222222-2222-4222-8222-222222222222'), 0, 'Account B deletion persisted');

select * from finish();
rollback;
