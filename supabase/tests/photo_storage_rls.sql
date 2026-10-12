-- RLS tests for assessment-photos Storage objects
-- (20261012120000_photo_storage_owner_scoped.sql). Each check prints PASS or
-- FAIL. ERROR lines are expected: they are the writes the policies reject.
-- Runs in its own fresh database (see run-rls-tests.sh).
\set ON_ERROR_STOP 0

-- ── Fixtures (as superuser) ──
-- 71…01 owner · 71…02 stranger · 71…03 inspector of org 74…01 (assessment 73…01 submitted to it)
insert into auth.users (id) values
  ('71000000-0000-4000-8000-000000000001'), ('71000000-0000-4000-8000-000000000002'),
  ('71000000-0000-4000-8000-000000000003');
insert into public.properties (id, user_id, address) values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '30 Photo St'),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', '40 Photo St');
insert into public.assessments (id, property_id) values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002');
insert into public.organizations (id, name, kind) values ('74000000-0000-4000-8000-000000000001', 'Photo FD', 'fire_agency');
insert into public.organization_members (organization_id, user_id, role)
  values ('74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000003', 'inspector');
insert into public.assessment_submissions (assessment_id, organization_id)
  values ('73000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001');
-- An existing object in the owner's folder.
insert into storage.objects (bucket_id, name)
  values ('assessment-photos', '73000000-0000-4000-8000-000000000001/p1.jpg');

create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;
create or replace function pg_temp.n(pattern text) returns bigint language sql as $$
  select count(*) from storage.objects where name like pattern $$;

-- ── Owner ──
set role authenticated; select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', false);
insert into storage.objects (bucket_id, name) values ('assessment-photos', '73000000-0000-4000-8000-000000000001/p2.jpg');
select pg_temp.check('owner can upload into their assessment folder', pg_temp.n('73000000-0000-4000-8000-000000000001/p2.jpg') = 1);
select pg_temp.check('owner can list their own photos', pg_temp.n('73000000-0000-4000-8000-000000000001/%') = 2);
insert into storage.objects (bucket_id, name) values ('assessment-photos', '73000000-0000-4000-8000-000000000002/planted.jpg');
insert into storage.objects (bucket_id, name) values ('assessment-photos', 'not-a-uuid/x.jpg');
update storage.objects set name = '73000000-0000-4000-8000-000000000002/moved.jpg'
  where name = '73000000-0000-4000-8000-000000000001/p2.jpg';
reset role;
select pg_temp.check('owner cannot upload into another assessment''s folder or an odd path',
  pg_temp.n('73000000-0000-4000-8000-000000000002/%') = 0 and pg_temp.n('not-a-uuid/%') = 0);
select pg_temp.check('owner cannot move an object into another assessment''s folder',
  pg_temp.n('73000000-0000-4000-8000-000000000001/p2.jpg') = 1);

-- ── Stranger: the old hole ──
set role authenticated; select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', false);
select pg_temp.check('stranger cannot list another owner''s photos', pg_temp.n('73000000-0000-4000-8000-000000000001/%') = 0);
update storage.objects set bucket_id = 'assessment-photos', name = name where name like '73000000-0000-4000-8000-000000000001/%';
delete from storage.objects where name like '73000000-0000-4000-8000-000000000001/%';
insert into storage.objects (bucket_id, name) values ('assessment-photos', '73000000-0000-4000-8000-000000000001/evil.jpg');
reset role;
select pg_temp.check('stranger cannot overwrite, delete or plant photos in another owner''s folder',
  pg_temp.n('73000000-0000-4000-8000-000000000001/%') = 2
  and pg_temp.n('73000000-0000-4000-8000-000000000001/evil.jpg') = 0);

-- ── Inspector of a submitted assessment: read, no write ──
set role authenticated; select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', false);
select pg_temp.check('reviewer can list a submitted assessment''s photos', pg_temp.n('73000000-0000-4000-8000-000000000001/%') = 2);
delete from storage.objects where name like '73000000-0000-4000-8000-000000000001/%';
reset role;
select pg_temp.check('reviewer cannot delete them', pg_temp.n('73000000-0000-4000-8000-000000000001/%') = 2);

-- ── Anonymous ──
set role anon; select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check('anon cannot list the bucket', (select count(*) from storage.objects) = 0);
insert into storage.objects (bucket_id, name) values ('assessment-photos', '73000000-0000-4000-8000-000000000001/anon.jpg');
reset role;
select pg_temp.check('anon cannot upload', pg_temp.n('%/anon.jpg') = 0);

-- ── Owner can still delete their own ──
set role authenticated; select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', false);
delete from storage.objects where name = '73000000-0000-4000-8000-000000000001/p2.jpg';
reset role;
select pg_temp.check('owner can delete their own photo', pg_temp.n('73000000-0000-4000-8000-000000000001/%') = 1);
