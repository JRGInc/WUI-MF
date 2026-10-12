-- RLS tests for token-bound shared-report reads
-- (20261012110000_share_token_bound_reads.sql). Each check prints PASS or FAIL.
-- The shared view sends its token in the x-share-token header; PostgREST
-- exposes headers as the request.headers GUC, simulated here with set_config.
-- Runs in its own psql session after the other *_rls.sql files; ids are distinct.
\set ON_ERROR_STOP 0

-- ── Fixtures (as superuser): two owners, each with one shared assessment ──
insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'), ('a1000000-0000-4000-8000-000000000002');
insert into public.properties (id, user_id, address) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '10 Share St'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', '20 Share St');
insert into public.assessments (id, property_id) values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002');
insert into public.mitigation_actions (id, assessment_id, recommendation_id, category, title, status) values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'r1', 'vegetation', 'x', 'planned'),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'r1', 'vegetation', 'x', 'planned');
insert into public.shared_reports (assessment_id, share_type, access_token, expires_at) values
  ('b2000000-0000-4000-8000-000000000001', 'link', 'token-one', now() + interval '1 day'),
  ('b2000000-0000-4000-8000-000000000002', 'link', 'token-two', now() + interval '1 day'),
  ('b2000000-0000-4000-8000-000000000002', 'link', 'token-expired', now() - interval '1 day');

create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;
create or replace function pg_temp.visible() returns bigint language sql as $$
  select count(*) from public.assessments
  where id in ('b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002') $$;

-- ── Anonymous, no token: the old hole ──
set role anon; select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check('anon cannot list share rows or tokens', (select count(*) from public.shared_reports) = 0);
select pg_temp.check('anon without a token cannot enumerate shared assessments', pg_temp.visible() = 0);
select pg_temp.check('anon without a token cannot read shared mitigations',
  (select count(*) from public.mitigation_actions where id::text like 'b3%') = 0);
select set_config('request.headers', '', false);
select pg_temp.check('an empty headers setting is handled (no json error)', pg_temp.visible() = 0);

-- ── Wrong / expired token ──
select set_config('request.headers', '{"x-share-token":"guess"}', false);
select pg_temp.check('a wrong token reads nothing', pg_temp.visible() = 0);
select set_config('request.headers', '{"x-share-token":"token-expired"}', false);
select pg_temp.check('an expired token reads nothing', pg_temp.visible() = 0);

-- ── Valid token: exactly its own report ──
select set_config('request.headers', '{"x-share-token":"token-one"}', false);
select pg_temp.check('a valid token reads exactly its own assessment',
  pg_temp.visible() = 1
  and exists (select 1 from public.assessments where id = 'b2000000-0000-4000-8000-000000000001'));
select pg_temp.check('a valid token reads its own mitigations only',
  (select count(*) from public.mitigation_actions where id::text like 'b3%') = 1);
select pg_temp.check('a valid token reads only its own share row',
  (select count(*) from public.shared_reports) = 1
  and (select access_token from public.shared_reports) = 'token-one');
update public.assessments set overall_score = 1 where id = 'b2000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.check('a token grants no writes',
  (select overall_score from public.assessments where id = 'b2000000-0000-4000-8000-000000000001') is distinct from 1);

-- ── A signed-in stranger is no different ──
set role authenticated; select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', false);
select set_config('request.headers', '', false);
select pg_temp.check('a signed-in user sees only their own share rows, not others''',
  (select count(*) from public.shared_reports where access_token like 'token-%') = 2
  and not exists (select 1 from public.shared_reports where access_token = 'token-one'));
select pg_temp.check('a signed-in user cannot read another user''s shared assessment without its token',
  not exists (select 1 from public.assessments where id = 'b2000000-0000-4000-8000-000000000001'));
reset role;
