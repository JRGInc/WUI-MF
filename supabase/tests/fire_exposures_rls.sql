-- Tests for fire_exposures and record_fire_exposure()
-- (20261013110000_fire_exposures.sql). Each check prints PASS or FAIL.
-- ERROR lines are expected: they are the calls the function rejects.
-- Runs in its own fresh database (see run-rls-tests.sh).
\set ON_ERROR_STOP 0

-- ── Fixtures (as superuser) ──
-- 81…01 owner · 81…02 inspector (org 1) · 81…03 viewer (org 1) · 81…04 inspector (org 2) · 81…05 stranger
insert into auth.users (id) values
  ('81000000-0000-4000-8000-000000000001'), ('81000000-0000-4000-8000-000000000002'),
  ('81000000-0000-4000-8000-000000000003'), ('81000000-0000-4000-8000-000000000004'),
  ('81000000-0000-4000-8000-000000000005');
insert into public.organizations (id, name, kind) values
  ('84000000-0000-4000-8000-000000000001', 'Fire FD', 'fire_agency'),
  ('84000000-0000-4000-8000-000000000002', 'Other Fire FD', 'fire_agency');
insert into public.organization_members (organization_id, user_id, role) values
  ('84000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'inspector'),
  ('84000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000003', 'viewer'),
  ('84000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000004', 'inspector');
insert into public.properties (id, user_id, address) values
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '1 Fire St'),
  ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', '2 Fire St');
insert into public.assessments (id, property_id, recommendations) values
  ('83000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001',
   '[{"id":"r1","priority":"immediate"},{"id":"r2","priority":"short-term"},{"id":"r3","priority":"immediate"}]'),
  ('83000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '[]');
-- Fire discovered 2026-08-01. r1 verified before it; r2 done (self-reported) before it;
-- r3 marked done only after it.
insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status, completed_at, verified_at) values
  ('85000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'r1', 'vegetation', 'x', 'verified',  '2026-07-01', '2026-07-15'),
  ('85000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'r2', 'vegetation', 'x', 'completed', '2026-07-20', null),
  ('85000000-0000-4000-8000-000000000003', '83000000-0000-4000-8000-000000000001', 'r3', 'vegetation', 'x', 'completed', '2026-08-10', null);
-- Only assessment 1 is submitted (to org 1).
insert into public.assessment_submissions (assessment_id, organization_id)
  values ('83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001');

create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;
create or replace function pg_temp.n() returns bigint language sql as $$
  select count(*) from public.fire_exposures $$;
create or replace function pg_temp.rec(uid text, aid text, rel text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform public.record_fire_exposure('84000000-0000-4000-8000-000000000001', aid::uuid,
    '{IRWIN-1}', 'Test Fire', '2026-08-01T00:00:00Z', 1200, rel, 'wfigs_ytd');
end $$;

-- ── Inspector records a 'near' exposure ──
set role authenticated;
select pg_temp.rec('81000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'near');
select pg_temp.check('the snapshot counts state as of discovery: 2 of 3 done, 1 verified, 1 immediate open',
  (select recommendations_total = 3 and done_at_start = 2 and verified_at_start = 1
      and immediate_outstanding_at_start = 1 and relation = 'near' and source = 'wfigs_ytd'
      and detected_by = '81000000-0000-4000-8000-000000000002'
   from public.fire_exposures));

-- The owner backdates r3, then the fire is re-detected as inside.
reset role;
update public.mitigation_actions set completed_at = '2026-07-01' where id = '85000000-0000-4000-8000-000000000003';
set role authenticated;
select pg_temp.rec('81000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'inside');
select pg_temp.check('re-detection upgrades near to inside but never recomputes the snapshot',
  (select count(*) = 1 from public.fire_exposures)
  and (select relation = 'inside' and done_at_start = 2 from public.fire_exposures));
select pg_temp.rec('81000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'near');
select pg_temp.check('a later near detection does not downgrade inside',
  (select relation from public.fire_exposures) = 'inside');

-- ── Rejections ──
select pg_temp.rec('81000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'adjacent');
select pg_temp.rec('81000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000002', 'inside');
select pg_temp.rec('81000000-0000-4000-8000-000000000003', '83000000-0000-4000-8000-000000000001', 'inside');
select pg_temp.rec('81000000-0000-4000-8000-000000000004', '83000000-0000-4000-8000-000000000001', 'inside');
select pg_temp.rec('81000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'inside');
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', false);
insert into public.fire_exposures (organization_id, assessment_id, incident_id, incident_name, relation, source,
  recommendations_total, done_at_start, verified_at_start, immediate_outstanding_at_start)
  values ('84000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'forged', 'Forged',
          'inside', 'x', 3, 3, 3, 0);
reset role;
select pg_temp.check('rejected: unknown relation, unsubmitted assessment, viewer, other org, owner, direct insert',
  pg_temp.n() = 1);

-- ── Visibility ──
set role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', false);
select pg_temp.check('a viewer of the org can read exposures', pg_temp.n() = 1);
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', false);
select pg_temp.check('the property owner can read their exposure', pg_temp.n() = 1);
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', false);
select pg_temp.check('another org''s inspector cannot', pg_temp.n() = 0);
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000005', false);
select pg_temp.check('a stranger cannot', pg_temp.n() = 0);
reset role;
set role anon; select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check('anon cannot read', pg_temp.n() = 0);
reset role;
select pg_temp.check('anon has no execute privilege on record_fire_exposure',
  not has_function_privilege('anon',
    'public.record_fire_exposure(uuid, uuid, text, text, timestamptz, numeric, text, text)', 'execute'));
