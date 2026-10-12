-- Tests for agency_dashboard() and set_submission_status()
-- (20261012140000_agency_dashboard.sql). Each check prints PASS or FAIL.
-- ERROR lines are expected: they are the calls the functions reject.
-- Runs in its own fresh database (see run-rls-tests.sh).
\set ON_ERROR_STOP 0

-- ── Fixtures (as superuser) ──
-- 51…01 owner A · 51…02 owner B · 51…03 inspector (org 1) · 51…04 viewer (org 1)
-- 51…05 inspector (org 2) · 51…06 stranger
insert into auth.users (id) values
  ('51000000-0000-4000-8000-000000000001'), ('51000000-0000-4000-8000-000000000002'),
  ('51000000-0000-4000-8000-000000000003'), ('51000000-0000-4000-8000-000000000004'),
  ('51000000-0000-4000-8000-000000000005'), ('51000000-0000-4000-8000-000000000006');
insert into public.organizations (id, name, kind) values
  ('54000000-0000-4000-8000-000000000001', 'Dash FD', 'fire_agency'),
  ('54000000-0000-4000-8000-000000000002', 'Other Dash FD', 'fire_agency');
insert into public.organization_members (organization_id, user_id, role) values
  ('54000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000003', 'inspector'),
  ('54000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', 'viewer'),
  ('54000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000005', 'inspector');
-- Property A has good coordinates; property B has a non-numeric latitude.
insert into public.properties (id, user_id, address, coordinates, parcel_id) values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '1 Dash St',
   '{"latitude": 43.6, "longitude": -116.2}', 'APN-1'),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', '2 Dash St',
   '{"latitude": "x", "longitude": -116.3}', null);
-- Assessment A: three current recommendations (r1, r3 immediate). Assessment B: null recommendations.
insert into public.assessments (id, property_id, overall_score, recommendations) values
  ('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 5,
   '[{"id":"r1","priority":"immediate"},{"id":"r2","priority":"short-term"},{"id":"r3","priority":"immediate"}]'),
  ('53000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', 7, null);
-- r1 verified, r2 in progress, r3 untouched; 'gone' is a stale action for a removed recommendation.
insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status) values
  ('55000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', 'r1', 'vegetation', 'x', 'verified'),
  ('55000000-0000-4000-8000-000000000002', '53000000-0000-4000-8000-000000000001', 'r2', 'vegetation', 'x', 'in_progress'),
  ('55000000-0000-4000-8000-000000000003', '53000000-0000-4000-8000-000000000001', 'gone', 'vegetation', 'x', 'completed');
insert into public.assessment_submissions (id, assessment_id, organization_id, submitted_at) values
  ('56000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000001', now() - interval '2 days'),
  ('56000000-0000-4000-8000-000000000002', '53000000-0000-4000-8000-000000000002', '54000000-0000-4000-8000-000000000001', now() - interval '1 day');

create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;
create or replace function pg_temp.sub_status(sid uuid) returns text language sql as $$
  select status from public.assessment_submissions where id = sid $$;

-- ── Inspector (org 1) ──
set role authenticated; select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', false);
select pg_temp.check('inspector sees every submission to their org, newest first',
  (select array_agg(address) from public.agency_dashboard('54000000-0000-4000-8000-000000000001')) = array['2 Dash St', '1 Dash St']);
select pg_temp.check('counts cover current recommendations only (stale action ignored)',
  (select recommendations_total = 3 and immediate_total = 2 and verified = 1 and in_progress = 1
      and completed = 0 and planned = 0 and immediate_outstanding = 1
   from public.agency_dashboard('54000000-0000-4000-8000-000000000001') where address = '1 Dash St'));
select pg_temp.check('location and parcel come through; a non-numeric coordinate is null, not an error',
  (select latitude = 43.6 and longitude = -116.2 and parcel_id = 'APN-1'
   from public.agency_dashboard('54000000-0000-4000-8000-000000000001') where address = '1 Dash St')
  and (select latitude is null and longitude = -116.3
   from public.agency_dashboard('54000000-0000-4000-8000-000000000001') where address = '2 Dash St'));
select pg_temp.check('null recommendations count as zero',
  (select recommendations_total = 0 and immediate_outstanding = 0
   from public.agency_dashboard('54000000-0000-4000-8000-000000000001') where address = '2 Dash St'));

select public.set_submission_status('56000000-0000-4000-8000-000000000001', 'bogus');
reset role;
select pg_temp.check('an unknown status is rejected',
  pg_temp.sub_status('56000000-0000-4000-8000-000000000001') = 'submitted');

set role authenticated; select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', false);
select status from public.set_submission_status('56000000-0000-4000-8000-000000000001', 'in_review');
reset role;
select pg_temp.check('inspector moves a submission to in_review; who and when are stamped',
  (select status = 'in_review' and status_changed_by = '51000000-0000-4000-8000-000000000003' and status_changed_at is not null
   from public.assessment_submissions where id = '56000000-0000-4000-8000-000000000001'));

-- ── Viewer (org 1): reads, cannot change status ──
set role authenticated; select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000004', false);
select pg_temp.check('viewer sees the dashboard',
  (select count(*) from public.agency_dashboard('54000000-0000-4000-8000-000000000001')) = 2);
select public.set_submission_status('56000000-0000-4000-8000-000000000001', 'closed');
reset role;
select pg_temp.check('viewer cannot change status',
  pg_temp.sub_status('56000000-0000-4000-8000-000000000001') = 'in_review');

-- ── Inspector of another org ──
set role authenticated; select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000005', false);
select pg_temp.check('another org''s inspector sees nothing of org 1',
  (select count(*) from public.agency_dashboard('54000000-0000-4000-8000-000000000001')) = 0);
select public.set_submission_status('56000000-0000-4000-8000-000000000001', 'closed');
reset role;
select pg_temp.check('another org''s inspector cannot change status',
  pg_temp.sub_status('56000000-0000-4000-8000-000000000001') = 'in_review');

-- ── Owner A: sees only their own submission, cannot change its status ──
set role authenticated; select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', false);
select pg_temp.check('an owner sees only their own submission, never another owner''s',
  (select array_agg(address) from public.agency_dashboard('54000000-0000-4000-8000-000000000001')) = array['1 Dash St']);
select public.set_submission_status('56000000-0000-4000-8000-000000000001', 'submitted');
update public.assessment_submissions set status = 'closed' where id = '56000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.check('an owner cannot change the status (function or direct update)',
  pg_temp.sub_status('56000000-0000-4000-8000-000000000001') = 'in_review');

-- ── Stranger and anon ──
set role authenticated; select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000006', false);
select pg_temp.check('a stranger sees nothing',
  (select count(*) from public.agency_dashboard('54000000-0000-4000-8000-000000000001')) = 0);
reset role;
select pg_temp.check('anon has no execute privilege on either function',
  not has_function_privilege('anon', 'public.agency_dashboard(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.set_submission_status(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.agency_dashboard(uuid)', 'execute'));
