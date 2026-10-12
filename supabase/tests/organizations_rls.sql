-- RLS + verification-function tests for organizations, memberships,
-- assessment submissions, and inspector verification of mitigation actions.
-- Each check prints PASS or FAIL. ERROR lines are expected: they are the
-- writes and calls the policies/functions reject.
-- Run with supabase/tests/run-rls-tests.sh (needs Docker). Runs in its own
-- fresh database (see run-rls-tests.sh).
\set ON_ERROR_STOP 0

-- ── Fixtures (as superuser) ──
-- c…01 owner · c…02 inspector (org 1) · c…03 viewer (org 1)
-- c…04 inspector (org 2) · c…05 stranger · c…06 admin (org 1)
insert into auth.users (id) values
  ('c0000000-0000-4000-8000-000000000001'), ('c0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000003'), ('c0000000-0000-4000-8000-000000000004'),
  ('c0000000-0000-4000-8000-000000000005'), ('c0000000-0000-4000-8000-000000000006');
insert into public.organizations (id, name, kind, state_code) values
  ('d0000000-0000-4000-8000-000000000001', 'Test Fire Dept', 'fire_agency', 'ID'),
  ('d0000000-0000-4000-8000-000000000002', 'Other Fire Dept', 'fire_agency', 'ID');
insert into public.organization_members (organization_id, user_id, role) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'inspector'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'viewer'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'inspector'),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'admin');
-- e…01/f…01: the owner's property/assessment. e…02/f…02: the org-1 inspector's own home.
insert into public.properties (id, user_id, address) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2 Test St'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '3 Test St');
insert into public.assessments (id, property_id) values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002');
-- 90…01 completed · 90…02 planned (both on f…01) · 90…03 completed on the inspector's own home
insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status) values
  ('90000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'r1', 'vegetation', 'Clear brush', 'completed'),
  ('90000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'r2', 'vegetation', 'Trim trees', 'planned'),
  ('90000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'r1', 'vegetation', 'Clear brush', 'completed');

create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;
create or replace function pg_temp.status_of(aid uuid) returns text language sql as $$
  select status from public.mitigation_actions where id = aid $$;

-- ── Before any submission, an inspector sees nothing and verifies nothing ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
select pg_temp.check('inspector cannot read an unsubmitted assessment',
  (select count(*) from public.assessments where id = 'f0000000-0000-4000-8000-000000000001') = 0);
select pg_temp.check('inspector cannot read unsubmitted mitigations',
  (select count(*) from public.mitigation_actions where assessment_id = 'f0000000-0000-4000-8000-000000000001') = 0);
select public.verify_mitigation_action('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check('inspector cannot verify before submission',
  pg_temp.status_of('90000000-0000-4000-8000-000000000001') = 'completed');

-- ── Owner submits to org 1 ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', false);
select pg_temp.check('owner can read organization names', (select count(*) from public.organizations) >= 2);
insert into public.assessment_submissions (assessment_id, organization_id, submitted_by)
  values ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001');
select pg_temp.check('owner can submit an assessment to an organization',
  (select count(*) from public.assessment_submissions where assessment_id = 'f0000000-0000-4000-8000-000000000001') = 1);
insert into public.assessment_submissions (assessment_id, organization_id, submitted_by)
  values ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005');
insert into public.assessment_submissions (assessment_id, organization_id, status)
  values ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'closed');
select pg_temp.check('owner cannot forge submitted_by or pre-set status',
  (select count(*) from public.assessment_submissions where assessment_id = 'f0000000-0000-4000-8000-000000000001') = 1);
select public.verify_mitigation_action('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');
insert into public.organization_members (organization_id, user_id, role)
  values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'inspector');
reset role;
select pg_temp.check('owner cannot verify via the function',
  pg_temp.status_of('90000000-0000-4000-8000-000000000001') = 'completed');
select pg_temp.check('owner cannot make themselves an inspector',
  (select count(*) from public.organization_members where user_id = 'c0000000-0000-4000-8000-000000000001') = 0);

-- ── Stranger ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000005', false);
insert into public.assessment_submissions (assessment_id, organization_id, submitted_by)
  values ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005');
select pg_temp.check('stranger cannot read submissions',
  (select count(*) from public.assessment_submissions where assessment_id = 'f0000000-0000-4000-8000-000000000001') = 0);
select pg_temp.check('stranger cannot read the submitted assessment',
  (select count(*) from public.assessments where id = 'f0000000-0000-4000-8000-000000000001') = 0);
reset role;
select pg_temp.check('stranger cannot submit someone else''s assessment',
  (select count(*) from public.assessment_submissions where assessment_id = 'f0000000-0000-4000-8000-000000000001') = 1);

-- ── Viewer (org 1): reads, cannot verify ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000003', false);
select pg_temp.check('viewer can read the submitted assessment, property and mitigations',
  (select count(*) from public.assessments where id = 'f0000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from public.properties where id = 'e0000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from public.mitigation_actions where assessment_id = 'f0000000-0000-4000-8000-000000000001') = 2);
select public.verify_mitigation_action('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check('viewer cannot verify',
  pg_temp.status_of('90000000-0000-4000-8000-000000000001') = 'completed');

-- ── Inspector of a different organization ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000004', false);
select pg_temp.check('other-org inspector cannot read the assessment',
  (select count(*) from public.assessments where id = 'f0000000-0000-4000-8000-000000000001') = 0);
select public.verify_mitigation_action('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002');
select public.verify_mitigation_action('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check('other-org inspector cannot verify (own org or by naming org 1)',
  pg_temp.status_of('90000000-0000-4000-8000-000000000001') = 'completed');

-- ── Inspector (org 1) ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
select pg_temp.check('inspector can read the submitted assessment, property and mitigations',
  (select count(*) from public.assessments where id = 'f0000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from public.properties where id = 'e0000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from public.mitigation_actions where assessment_id = 'f0000000-0000-4000-8000-000000000001') = 2);
update public.mitigation_actions set status = 'verified', verified_at = now()
  where id = '90000000-0000-4000-8000-000000000001';
update public.assessments set overall_score = 1 where id = 'f0000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.check('inspector cannot write the tables directly',
  pg_temp.status_of('90000000-0000-4000-8000-000000000001') = 'completed'
  and (select overall_score from public.assessments where id = 'f0000000-0000-4000-8000-000000000001') is distinct from 1);

set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
select public.verify_mitigation_action('90000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check('a planned (not completed) item cannot be verified',
  pg_temp.status_of('90000000-0000-4000-8000-000000000002') = 'planned');

set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
select status from public.verify_mitigation_action(
  '90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '  Brush cleared, checked on site  ');
reset role;
select pg_temp.check('inspector verifies a completed item; server stamps who, which org, when, and the trimmed note',
  (select status = 'verified'
      and verified_by = 'c0000000-0000-4000-8000-000000000002'
      and verifier_organization_id = 'd0000000-0000-4000-8000-000000000001'
      and verified_at is not null
      and verification_note = 'Brush cleared, checked on site'
   from public.mitigation_actions where id = '90000000-0000-4000-8000-000000000001'));

-- Conflict of interest: the inspector submits their own home to their own org.
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
insert into public.assessment_submissions (assessment_id, organization_id, submitted_by)
  values ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');
select public.verify_mitigation_action('90000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check('inspector cannot verify their own property',
  pg_temp.status_of('90000000-0000-4000-8000-000000000003') = 'completed');

-- ── The owner stays locked out of a verified row ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', false);
select pg_temp.check('owner sees the verification',
  (select status from public.mitigation_actions where id = '90000000-0000-4000-8000-000000000001') = 'verified');
update public.mitigation_actions set status = 'completed' where id = '90000000-0000-4000-8000-000000000001';
select public.revoke_mitigation_verification('90000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check('owner cannot edit or revoke a verified row',
  pg_temp.status_of('90000000-0000-4000-8000-000000000001') = 'verified');

-- ── Revoke ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000004', false);
select public.revoke_mitigation_verification('90000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check('another organization cannot revoke',
  pg_temp.status_of('90000000-0000-4000-8000-000000000001') = 'verified');

set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
select status from public.revoke_mitigation_verification('90000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check('verifying org revokes: back to completed, verification fields cleared',
  (select status = 'completed' and verified_by is null and verified_at is null
      and verifier_organization_id is null and verification_note is null
   from public.mitigation_actions where id = '90000000-0000-4000-8000-000000000001'));

set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', false);
update public.mitigation_actions set notes = 'after revoke' where id = '90000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.check('owner can edit again after a revoke',
  (select notes from public.mitigation_actions where id = '90000000-0000-4000-8000-000000000001') = 'after revoke');

-- ── Anonymous ──
set role anon; select set_config('request.jwt.claim.sub', '', false);
select public.verify_mitigation_action('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');
select pg_temp.check('anon can read organization names', (select count(*) from public.organizations) >= 2);
select pg_temp.check('anon cannot read memberships or submissions',
  (select count(*) from public.organization_members) = 0
  and (select count(*) from public.assessment_submissions) = 0);
select pg_temp.check('an agency submission does not make the assessment public',
  (select count(*) from public.assessments where id = 'f0000000-0000-4000-8000-000000000001') = 0);
reset role;
select pg_temp.check('anon has no execute privilege on the verification functions',
  not has_function_privilege('anon', 'public.verify_mitigation_action(uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.revoke_mitigation_verification(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.verify_mitigation_action(uuid, uuid, text)', 'execute'));
select pg_temp.check('anon cannot verify',
  pg_temp.status_of('90000000-0000-4000-8000-000000000001') = 'completed');

-- ── Membership visibility ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
select pg_temp.check('a non-admin member sees only their own membership',
  (select count(*) from public.organization_members) = 1);
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000006', false);
select pg_temp.check('an org admin sees their org''s roster (no policy recursion)',
  (select count(*) from public.organization_members where organization_id = 'd0000000-0000-4000-8000-000000000001') = 3
  and (select count(*) from public.organization_members where organization_id = 'd0000000-0000-4000-8000-000000000002') = 0);
reset role;

-- ── Withdrawing a submission removes access ──
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
delete from public.assessment_submissions where assessment_id = 'f0000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.check('an inspector cannot delete a submission',
  (select count(*) from public.assessment_submissions where assessment_id = 'f0000000-0000-4000-8000-000000000001') = 1);
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', false);
delete from public.assessment_submissions where assessment_id = 'f0000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', false);
select pg_temp.check('after the owner withdraws, the inspector loses read access',
  (select count(*) from public.assessments where id = 'f0000000-0000-4000-8000-000000000001') = 0);
reset role;
