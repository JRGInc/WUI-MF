-- RLS tests for public.mitigation_actions. Each check prints PASS or FAIL.
-- ERROR lines are expected: they are the writes the policies reject.
-- Run with supabase/tests/run-rls-tests.sh (needs Docker).
\set ON_ERROR_STOP 0
-- fixtures (as superuser)
insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002');
insert into public.properties (id, user_id, address) values ('11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','1 Test St');
insert into public.assessments (id, property_id) values ('22222222-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001');

create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;

-- ── Owner (user A) ──
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001', false);
insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status, created_by)
  values ('33333333-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000001','r1','roof-structure','Clear gutters','planned','aaaaaaaa-0000-4000-8000-000000000001')
  on conflict (id) do update set status = excluded.status;
select pg_temp.check('owner can insert', (select count(*) from public.mitigation_actions) = 1);

insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status, completed_at)
  values ('33333333-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000001','r1','roof-structure','Clear gutters','completed', now())
  on conflict (id) do update set status = excluded.status, completed_at = excluded.completed_at;
select pg_temp.check('owner upsert updates to completed', (select status from public.mitigation_actions) = 'completed');

update public.mitigation_actions set status = 'verified';
select pg_temp.check('owner cannot self-verify via status', (select status from public.mitigation_actions) = 'completed');
update public.mitigation_actions set verified_at = now();
select pg_temp.check('owner cannot set verified_at', (select verified_at from public.mitigation_actions) is null);
insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status)
  values ('33333333-0000-4000-8000-000000000002','22222222-0000-4000-8000-000000000001','r2','vegetation','x','verified');
select pg_temp.check('owner cannot insert verified row', (select count(*) from public.mitigation_actions where recommendation_id='r2') = 0);

-- ── Stranger (user B) ──
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002', false);
select pg_temp.check('stranger cannot read', (select count(*) from public.mitigation_actions) = 0);
insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status)
  values ('33333333-0000-4000-8000-000000000003','22222222-0000-4000-8000-000000000001','r3','vegetation','x','planned');
update public.mitigation_actions set status = 'planned';
delete from public.mitigation_actions;
reset role;
select pg_temp.check('stranger cannot insert/update/delete', (select count(*) from public.mitigation_actions) = 1 and (select status from public.mitigation_actions) = 'completed');

-- ── Anonymous shared-link viewer ──
set role anon; select set_config('request.jwt.claim.sub','', false);
select pg_temp.check('anon cannot read unshared', (select count(*) from public.mitigation_actions) = 0);
reset role;
insert into public.shared_reports (assessment_id, share_type, access_token, expires_at) values ('22222222-0000-4000-8000-000000000001','link','tok', now() + interval '1 day');
set role anon;
select pg_temp.check('anon without the token cannot read shared', (select count(*) from public.mitigation_actions) = 0);
select set_config('request.headers', '{"x-share-token":"tok"}', false);
select pg_temp.check('anon can read shared with the token', (select count(*) from public.mitigation_actions) = 1);
update public.mitigation_actions set notes = 'hacked';
reset role;
select pg_temp.check('anon cannot write shared', (select notes from public.mitigation_actions) is null);

-- ── Verified rows lock the owner out ──
update public.mitigation_actions set status = 'verified', verified_at = now();  -- as superuser (stands in for service role / inspector)
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001', false);
update public.mitigation_actions set status = 'planned';
delete from public.mitigation_actions;
select pg_temp.check('owner cannot edit or delete verified row', (select status from public.mitigation_actions) = 'verified');
reset role;

-- ── Trigger, unique constraint, view ──
select pg_temp.check('updated_at set by trigger', (select updated_at from public.mitigation_actions) > (select created_at from public.mitigation_actions) - interval '1 second');
insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status)
  values ('33333333-0000-4000-8000-000000000009','22222222-0000-4000-8000-000000000001','r1','roof-structure','dup','planned');
select pg_temp.check('unique (assessment, recommendation) enforced', (select count(*) from public.mitigation_actions) = 1);
select pg_temp.check('usage view counts', (select mitigations_logged = 1 and mitigations_completed = 1 and mitigations_verified = 1 from public.analytics_usage_summary));
