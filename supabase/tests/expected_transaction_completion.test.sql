begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values ('c1111111-1111-4111-8111-111111111111','authenticated','authenticated','completion-a@example.test','','{}','{}'),
 ('c2222222-2222-4222-8222-222222222222','authenticated','authenticated','completion-b@example.test','','{}','{}');
insert into public.categories (id,user_id,name,type,is_archived) values
 ('c3333333-3333-4333-8333-333333333331','c1111111-1111-4111-8111-111111111111','Completion expense','expense',false),
 ('c3333333-3333-4333-8333-333333333332','c1111111-1111-4111-8111-111111111111','Completion income','income',false),
 ('c3333333-3333-4333-8333-333333333333','c2222222-2222-4222-8222-222222222222','B category','expense',false),
 ('c3333333-3333-4333-8333-333333333334','c1111111-1111-4111-8111-111111111111','Archived category','expense',true);
insert into public.payment_methods(id,user_id,nickname,type,is_archived) values
 ('c4444444-4444-4444-8444-444444444441','c1111111-1111-4111-8111-111111111111','Active method','checking',false),
 ('c4444444-4444-4444-8444-444444444442','c2222222-2222-4222-8222-222222222222','B method','checking',false),
 ('c4444444-4444-4444-8444-444444444443','c1111111-1111-4111-8111-111111111111','Archived method','checking',true);
insert into public.expected_transactions(id,user_id,title,amount,type,expected_date,status) values
 ('c5555555-5555-4555-8555-555555555551','c1111111-1111-4111-8111-111111111111','Success',100,'expense','2026-10-01','planned'),
 ('c5555555-5555-4555-8555-555555555552','c1111111-1111-4111-8111-111111111111','Validation',100,'expense','2026-10-01','planned'),
 ('c5555555-5555-4555-8555-555555555553','c1111111-1111-4111-8111-111111111111','Cancelled',100,'expense','2026-10-01','cancelled'),
 ('c5555555-5555-4555-8555-555555555554','c2222222-2222-4222-8222-222222222222','Private B',100,'expense','2026-10-01','planned');

select ok(has_function_privilege('authenticated','public.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text)','EXECUTE'), 'authenticated can execute narrow RPC');
select ok(not has_function_privilege('anon','public.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text)','EXECUTE'), 'anon cannot execute RPC');
select ok(not exists(select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid='public.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text)'::regprocedure and a.grantee=0), 'PUBLIC has no RPC execute');
select ok(not (select prosecdef from pg_proc where oid='public.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text)'::regprocedure), 'public wrapper uses invoker security');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='private.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text)'::regprocedure), 'private definer has fixed empty search_path');
select ok(not has_function_privilege('anon','private.complete_expected_transaction(uuid,text,numeric,date,uuid,uuid,text)','EXECUTE'), 'anon cannot execute implementation');

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.complete_expected_transaction('c5555555-5555-4555-8555-555555555551','Actual',12,'2026-10-02',null,null,null)$$,'42501',null,'null auth rejected');
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select throws_ok($$select public.complete_expected_transaction('c5555555-5555-4555-8555-555555555554','Actual',12,'2026-10-02',null,null,null)$$,'P0002',null,'cannot complete other owner event');
select throws_ok($$select public.complete_expected_transaction('c5555555-5555-4555-8555-555555555553','Actual',12,'2026-10-02',null,null,null)$$,'P0001',null,'cancelled event cannot convert');

select throws_ok(format('select public.complete_expected_transaction(%L,%L,%s,%L,null,null,null)',
 'c5555555-5555-4555-8555-555555555552',v.title,v.amount,v.dt),'22023',null,v.label)
from (values (' ', '1', '2026-10-02','blank title'),('Valid','0','2026-10-02','zero'),
 ('Valid','-1','2026-10-02','negative'),('Valid',quote_literal('NaN')||'::numeric','2026-10-02','NaN'),
 ('Valid',quote_literal('Infinity')||'::numeric','2026-10-02','Infinity'),
 ('Valid','1000000000000','2026-10-02','maximum'),('Valid','1.001','2026-10-02','precision'),
 ('Valid','1','infinity','infinite date'),('Valid','1',null,'missing date')) v(title,amount,dt,label);
select throws_ok($$select public.complete_expected_transaction('c5555555-5555-4555-8555-555555555552','Valid',1,'2026-02-30',null,null,null)$$,'22008',null,'invalid calendar date');
select throws_ok(format('select public.complete_expected_transaction(%L,%L,1,%L,%L,null,null)',
 'c5555555-5555-4555-8555-555555555552','Valid','2026-10-02',v.id),'22023',null,v.label)
from (values ('c3333333-3333-4333-8333-333333333332','wrong category type'),
 ('c3333333-3333-4333-8333-333333333333','cross-owner category'),
 ('c3333333-3333-4333-8333-333333333334','archived category')) v(id,label);
select throws_ok(format('select public.complete_expected_transaction(%L,%L,1,%L,null,%L,null)',
 'c5555555-5555-4555-8555-555555555552','Valid','2026-10-02',v.id),'22023',null,v.label)
from (values ('c4444444-4444-4444-8444-444444444442','cross-owner payment'),
 ('c4444444-4444-4444-8444-444444444443','archived payment')) v(id,label);
select is((select count(*)::int from public.transactions),0,'validation failures create no actuals');
select is((select status from public.expected_transactions where title='Validation'),'planned','failure leaves expected planned');
create temporary table completion_result (payload jsonb);
insert into completion_result select public.complete_expected_transaction('c5555555-5555-4555-8555-555555555551','  Actual override  ',123.45,'2024-02-29','c3333333-3333-4333-8333-333333333331','c4444444-4444-4444-8444-444444444441','Actual notes');
select is((select payload->>'already_completed' from completion_result),'false','first result reports newly completed');
select is((select status from public.expected_transactions where title='Success'),'completed','expected is completed');
select ok((select completed_at is not null and actual_transaction_id is not null from public.expected_transactions where title='Success'),'completion fields populated');
select is((select title from public.transactions),'Actual override','title trimmed override');
select is((select amount from public.transactions),123.45::numeric,'actual amount override');
select is((select transaction_date::text from public.transactions),'2024-02-29','calendar day exact');
select is((select type from public.transactions),'expense','type retained');
select is((select notes from public.transactions),'Actual notes','notes override');
select is((select source from public.transactions),'manual','manual source');
select is((select category_id::text from public.transactions),'c3333333-3333-4333-8333-333333333331','owned category');
select is((select payment_method_id::text from public.transactions),'c4444444-4444-4444-8444-444444444441','owned payment');
select is((public.complete_expected_transaction('c5555555-5555-4555-8555-555555555551','Ignored',999,'2026-10-02',null,null,null)->>'already_completed'),'true','repeat returns explicit idempotent result');
select is((public.complete_expected_transaction('c5555555-5555-4555-8555-555555555551',null,null,null,null,null,null)->'actual_transaction'->>'id'),(select payload->'actual_transaction'->>'id' from completion_result),'retry returns original actual UUID even without valid overrides');
select is((select count(*)::int from public.transactions),1,'repeat creates exactly one actual');
select throws_ok($$update public.expected_transactions set completed_at=now() where title='Success'$$,'42501',null,'direct completion fields remain protected');
select throws_ok($$delete from public.transactions where title='Actual override'$$,'23503',null,'linked actual deletion restricted');
select lives_ok($$delete from public.expected_transactions where title='Success'$$,'completed delete safely affects no rows');
select is((select count(*)::int from public.expected_transactions where title='Success'),1,'completed history retained');

-- Failure after actual insertion proves the entire operation rolls back.
reset role;
create function pg_temp.reject_completion() returns trigger language plpgsql as $$begin raise exception 'test failure' using errcode='P0001'; end;$$;
create trigger completion_test_failure before update on public.expected_transactions for each row execute function pg_temp.reject_completion();
set local role authenticated;
select throws_ok($$select public.complete_expected_transaction('c5555555-5555-4555-8555-555555555552','Rollback actual',1,'2026-10-02',null,null,null)$$,'P0001',null,'failure after insert rolls back');
select is((select count(*)::int from public.transactions),1,'no orphan actual after later failure');
select is((select status from public.expected_transactions where title='Validation'),'planned','later failure retains planned state');
reset role;
drop trigger completion_test_failure on public.expected_transactions;
set local role authenticated;
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select lives_ok($$select public.complete_expected_transaction('c5555555-5555-4555-8555-555555555554','B actual',2,'2026-10-02',null,null,null)$$,'B can independently complete own event');
select is((select count(*)::int from public.transactions),1,'B sees only own new actual');
select lives_ok($$insert into public.expected_transactions(title,amount,type,expected_date) values ('B income',1,'income','2026-10-01'),('B savings',2,'savings','2026-10-01'),('B debt',3,'debt','2026-10-01')$$,'other event types created normally');
select lives_ok(format('select public.complete_expected_transaction(%L,%L,%s,%L,null,null,null)',id,title,amount,'2026-10-02'),type || ' completion succeeds') from public.expected_transactions where status='planned';
select is((select count(*)::int from public.transactions),4,'all four actual types recorded');
select * from finish();
rollback;
