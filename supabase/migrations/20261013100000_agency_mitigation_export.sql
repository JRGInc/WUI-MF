-- Per-recommendation export for grant reporting (WFCA Phase 2 C5-2 "support
-- grant reporting"): one row per CURRENT recommendation on each assessment
-- submitted to the org, with its mitigation status, dates and verification.
-- Same model as agency_dashboard (20261012140000): SECURITY INVOKER, so the
-- reviewer policies decide visibility and the function adds no access logic.
-- Recommendations with no mitigation record report status 'not_started'.

create or replace function public.agency_mitigation_export(p_organization_id uuid)
returns table (
  submission_id       uuid,
  assessment_id       uuid,
  submission_status   text,
  address             text,
  parcel_id           text,
  recommendation_id   text,
  title               text,
  category            text,
  priority            text,
  status              text,
  owner_notes         text,
  evidence_photos     integer,
  completed_at        timestamptz,
  verified_at         timestamptz,
  verifier_organization text,
  verification_note   text
)
language sql stable security invoker set search_path = public as $$
  select
    s.id, s.assessment_id, s.status,
    p.address, p.parcel_id,
    r ->> 'id', r ->> 'title', r ->> 'category', r ->> 'priority',
    coalesce(m.status, 'not_started'),
    m.notes,
    coalesce(cardinality(m.evidence_photo_ids), 0),
    m.completed_at, m.verified_at,
    o.name, m.verification_note
  from public.assessment_submissions s
  join public.assessments a on a.id = s.assessment_id
  join public.properties p on p.id = a.property_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(a.recommendations) = 'array' then a.recommendations else '[]'::jsonb end
  ) with ordinality as rec(r, ord)
  left join public.mitigation_actions m
    on m.assessment_id = a.id and m.recommendation_id = r ->> 'id'
  left join public.organizations o on o.id = m.verifier_organization_id
  where s.organization_id = p_organization_id
  order by p.address, s.assessment_id, rec.ord;
$$;

revoke all on function public.agency_mitigation_export(uuid) from public, anon;
grant execute on function public.agency_mitigation_export(uuid) to authenticated;
