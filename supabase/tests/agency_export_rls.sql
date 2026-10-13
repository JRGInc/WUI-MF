-- Tests for agency_mitigation_export() (20261013100000_agency_mitigation_export.sql).
-- Each check prints PASS or FAIL. Runs in its own fresh database (see run-rls-tests.sh).
\set ON_ERROR_STOP 0

-- ── Fixtures (as superuser) ──
-- 61…01 owner · 61…02 inspector (org 1) · 61…03 inspector (org 2) · 61…04 other owner
insert into auth.users (id) values
  ('61000000-0000-4000-8000-000000000001'), ('61000000-0000-4000-8000-000000000002'),
  ('61000000-0000-4000-8000-000000000003'), ('61000000-0000-4000-8000-000000000004');
insert into public.organizations (id, name, kind) values
  ('64000000-0000-4000-8000-000000000001', 'Export FD', 'fire_agency'),
  ('64000000-0000-4000-8000-000000000002', 'Other Export FD', 'fire_agency');
insert into public.organization_members (organization_id, user_id, role) values
  ('64000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'inspector'),
  ('64000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003', 'inspector');
insert into public.properties (id, user_id, address, parcel_id) values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '1 Export St', 'APN-9'),
  ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000004', '2 Export St', null);
insert into public.assessments (id, property_id, recommendations) values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001',
   '[{"id":"r1","title":"Clear gutters","category":"roof-structure","priority":"immediate"},
     {"id":"r2","title":"Trim trees","category":"vegetation","priority":"short-term"}]'),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000002', null);
-- r1 verified by org 1 with evidence; 'gone' is stale; r2 has no record.
insert into public.mitigation_actions
  (id, assessment_id, recommendation_id, category, title, status, notes, evidence_photo_ids,
   completed_at, verified_at, verifier_organization_id, verification_note) values
  ('65000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', 'r1', 'roof-structure', 'Clear gutters',
   'verified', 'Done by owner', '{p1,p2}', now() - interval '3 days', now() - interval '1 day',
   '64000000-0000-4000-8000-000000000001', 'Checked on site'),
  ('65000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000001', 'gone', 'vegetation', 'x',
   'completed', null, '{}', now(), null, null, null);
insert into public.assessment_submissions (assessment_id, organization_id) values
  ('63000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001'),
  ('63000000-0000-4000-8000-000000000002', '64000000-0000-4000-8000-000000000001');

create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;

-- ── Inspector (org 1) ──
set role authenticated; select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', false);
select pg_temp.check('one row per current recommendation, in recommendation order; stale actions and empty assessments excluded',
  (select array_agg(recommendation_id) from public.agency_mitigation_export('64000000-0000-4000-8000-000000000001'))
  = array['r1', 'r2']);
select pg_temp.check('a verified item carries its dates, evidence count, verifier name and note',
  (select status = 'verified' and title = 'Clear gutters' and priority = 'immediate' and parcel_id = 'APN-9'
      and evidence_photos = 2 and completed_at is not null and verified_at is not null
      and verifier_organization = 'Export FD' and verification_note = 'Checked on site'
      and owner_notes = 'Done by owner'
   from public.agency_mitigation_export('64000000-0000-4000-8000-000000000001') where recommendation_id = 'r1'));
select pg_temp.check('an untouched recommendation reports not_started with zero evidence',
  (select status = 'not_started' and evidence_photos = 0 and completed_at is null
   from public.agency_mitigation_export('64000000-0000-4000-8000-000000000001') where recommendation_id = 'r2'));

-- ── Other org / owners ──
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', false);
select pg_temp.check('another org''s inspector exports nothing of org 1',
  (select count(*) from public.agency_mitigation_export('64000000-0000-4000-8000-000000000001')) = 0);
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', false);
select pg_temp.check('another owner exports nothing of the first owner''s property',
  (select count(*) from public.agency_mitigation_export('64000000-0000-4000-8000-000000000001')
   where address = '1 Export St') = 0);
reset role;
select pg_temp.check('anon has no execute privilege',
  not has_function_privilege('anon', 'public.agency_mitigation_export(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.agency_mitigation_export(uuid)', 'execute'));
