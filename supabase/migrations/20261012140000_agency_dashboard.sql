-- Agency dashboard (WFCA Phase 2 C5-2: "see completed and planned mitigation
-- across all jurisdictions … coordinate crews"). Builds on
-- 20261012100000_organizations_inspector_verification.sql.
--
-- agency_dashboard(org): one row per assessment submitted to the org, with the
--   property location and mitigation counts over the assessment's CURRENT
--   recommendations (same rule as summarizeMitigation on the client: actions
--   for recommendations no longer on the assessment are ignored).
--   SECURITY INVOKER: the item-1 reviewer policies decide what the caller
--   sees, so the function adds no access logic of its own. A non-member gets
--   no rows.
-- set_submission_status(submission, status): inspector/admin of the
--   submission's org moves it submitted → in_review → closed (any order).
--   SECURITY DEFINER because there is deliberately no UPDATE policy on
--   assessment_submissions (an update policy would let a member re-point a
--   submission at another assessment).

alter table public.assessment_submissions
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

-- A coordinate from the properties.coordinates JSON, or null if absent or not
-- a number (checked before casting, so odd data can't make the query error).
create or replace function public.json_coordinate(c jsonb, k text)
returns double precision language sql immutable as $$
  select case when jsonb_typeof(c -> k) = 'number' then (c ->> k)::double precision end;
$$;

create or replace function public.agency_dashboard(p_organization_id uuid)
returns table (
  submission_id          uuid,
  assessment_id          uuid,
  submission_status      text,
  submitted_at           timestamptz,
  status_changed_at      timestamptz,
  address                text,
  parcel_id              text,
  latitude               double precision,
  longitude              double precision,
  overall_score          numeric,
  assessment_completed_at timestamptz,
  recommendations_total  integer,
  immediate_total        integer,
  planned                integer,
  in_progress            integer,
  completed              integer,  -- completed and not (yet) verified
  verified               integer,
  immediate_outstanding  integer   -- immediate recommendations not completed/verified
)
language sql stable security invoker set search_path = public as $$
  with recs as (
    select a.id as assessment_id, r ->> 'id' as rec_id, r ->> 'priority' as priority
    from public.assessment_submissions s
    join public.assessments a on a.id = s.assessment_id
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(a.recommendations) = 'array' then a.recommendations else '[]'::jsonb end
    ) r
    where s.organization_id = p_organization_id
  ),
  rec_status as (
    select recs.assessment_id, recs.priority, m.status
    from recs
    left join public.mitigation_actions m
      on m.assessment_id = recs.assessment_id and m.recommendation_id = recs.rec_id
  ),
  counts as (
    select
      assessment_id,
      count(*)::int                                                         as recommendations_total,
      count(*) filter (where priority = 'immediate')::int                   as immediate_total,
      count(*) filter (where status = 'planned')::int                       as planned,
      count(*) filter (where status = 'in_progress')::int                   as in_progress,
      count(*) filter (where status = 'completed')::int                     as completed,
      count(*) filter (where status = 'verified')::int                      as verified,
      count(*) filter (where priority = 'immediate'
                         and status is distinct from 'completed'
                         and status is distinct from 'verified')::int       as immediate_outstanding
    from rec_status
    group by assessment_id
  )
  select
    s.id, s.assessment_id, s.status, s.submitted_at, s.status_changed_at,
    p.address, p.parcel_id,
    public.json_coordinate(p.coordinates, 'latitude'),
    public.json_coordinate(p.coordinates, 'longitude'),
    a.overall_score, a.completed_at,
    coalesce(c.recommendations_total, 0), coalesce(c.immediate_total, 0),
    coalesce(c.planned, 0), coalesce(c.in_progress, 0), coalesce(c.completed, 0),
    coalesce(c.verified, 0), coalesce(c.immediate_outstanding, 0)
  from public.assessment_submissions s
  join public.assessments a on a.id = s.assessment_id
  join public.properties p on p.id = a.property_id
  left join counts c on c.assessment_id = s.assessment_id
  where s.organization_id = p_organization_id
  order by s.submitted_at desc;
$$;

create or replace function public.set_submission_status(p_submission_id uuid, p_status text)
returns public.assessment_submissions
language plpgsql security definer set search_path = public as $$
declare
  s public.assessment_submissions;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update submissions' using errcode = '28000';
  end if;
  if p_status not in ('submitted', 'in_review', 'closed') then
    raise exception 'Unknown submission status %', p_status using errcode = '22023';
  end if;

  select * into s from public.assessment_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = s.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'inspector')
  ) then
    raise exception 'Not authorized to update this submission' using errcode = '42501';
  end if;

  update public.assessment_submissions
     set status = p_status,
         status_changed_at = now(),
         status_changed_by = auth.uid()
   where id = p_submission_id
  returning * into s;
  return s;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon explicitly, so
-- revoke from anon as well as PUBLIC (see 20261012130000).
revoke all on function public.agency_dashboard(uuid) from public, anon;
revoke all on function public.set_submission_status(uuid, text) from public, anon;
grant execute on function public.agency_dashboard(uuid) to authenticated;
grant execute on function public.set_submission_status(uuid, text) to authenticated;
