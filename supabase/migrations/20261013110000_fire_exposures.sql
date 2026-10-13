-- Fire exposures (WFCA Phase 2 C5-2 KSA-7: "effectiveness monitoring and
-- learning system — automatic intersection with fire events for evaluation").
--
-- A row records that a wildfire perimeter reached (inside) or came within 1 km
-- of (near) a property submitted to an organization, with a snapshot of the
-- property's mitigation AS OF THE FIRE'S DISCOVERY — the input an
-- effectiveness analysis (did mitigated homes fare better?) needs.
--
-- Detection runs in the agency dashboard against NIFC's WFIGS year-to-date
-- perimeters; rows are written only through record_fire_exposure(), which
-- checks the caller and computes the snapshot server-side:
--   verified_at_start — items verified (verified_at is server-stamped) by the
--                       discovery time: trustworthy.
--   done_at_start     — items completed or verified by then, using the owner's
--                       completed_at: self-reported.
-- The snapshot is written once, at first detection, and never recomputed, so
-- marking items done after a fire cannot improve the record. Re-detection only
-- upgrades near → inside and refreshes the fire's size and name.
-- Persisting matters: the YTD service resets every January.

create table if not exists public.fire_exposures (
  id                            uuid primary key default gen_random_uuid(),
  organization_id               uuid not null references public.organizations(id) on delete cascade,
  assessment_id                 uuid not null references public.assessments(id) on delete cascade,
  incident_id                   text not null,    -- IRWIN id (or source-specific id)
  incident_name                 text not null,
  discovered_at                 timestamptz,
  acres                         numeric,
  relation                      text not null check (relation in ('inside', 'near')),
  source                        text not null,    -- e.g. 'wfigs_ytd'
  recommendations_total         integer not null,
  done_at_start                 integer not null,
  verified_at_start             integer not null,
  immediate_outstanding_at_start integer not null,
  detected_at                   timestamptz not null default now(),
  detected_by                   uuid references auth.users(id) on delete set null,
  updated_at                    timestamptz not null default now(),
  unique (organization_id, assessment_id, incident_id)
);
create index if not exists fire_exposures_org_idx on public.fire_exposures (organization_id);

alter table public.fire_exposures enable row level security;

-- Read: members of the organization, and the property owner. No write
-- policies: rows come only from record_fire_exposure().
create policy "fire_exposures_select_org" on public.fire_exposures
  for select using (public.user_is_org_member(organization_id));
create policy "fire_exposures_select_owner" on public.fire_exposures
  for select using (public.user_owns_assessment(assessment_id));

create or replace function public.record_fire_exposure(
  p_organization_id uuid,
  p_assessment_id uuid,
  p_incident_id text,
  p_incident_name text,
  p_discovered_at timestamptz,
  p_acres numeric,
  p_relation text,
  p_source text
)
returns public.fire_exposures
language plpgsql security definer set search_path = public as $$
declare
  e public.fire_exposures;
  total int; done int; verified int; immediate_open int;
  cutoff timestamptz := coalesce(p_discovered_at, now());
begin
  if auth.uid() is null then
    raise exception 'Sign in to record fire exposures' using errcode = '28000';
  end if;
  if p_relation not in ('inside', 'near') then
    raise exception 'Unknown relation %', p_relation using errcode = '22023';
  end if;
  if coalesce(btrim(p_incident_id), '') = '' or coalesce(btrim(p_incident_name), '') = '' then
    raise exception 'An incident id and name are required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organization_members m
    join public.assessment_submissions s on s.organization_id = m.organization_id
    where m.user_id = auth.uid()
      and m.organization_id = p_organization_id
      and m.role in ('admin', 'inspector')
      and s.assessment_id = p_assessment_id
  ) then
    raise exception 'Not authorized to record exposures for this assessment' using errcode = '42501';
  end if;

  -- Snapshot over the assessment's current recommendations, as of the cutoff.
  select
    count(*)::int,
    count(*) filter (where (m.status in ('completed', 'verified') and m.completed_at <= cutoff)
                        or m.verified_at <= cutoff)::int,
    count(*) filter (where m.verified_at <= cutoff)::int,
    count(*) filter (where r ->> 'priority' = 'immediate'
                       and not coalesce((m.status in ('completed', 'verified') and m.completed_at <= cutoff)
                                        or m.verified_at <= cutoff, false))::int
  into total, done, verified, immediate_open
  from public.assessments a
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(a.recommendations) = 'array' then a.recommendations else '[]'::jsonb end
  ) r
  left join public.mitigation_actions m
    on m.assessment_id = a.id and m.recommendation_id = r ->> 'id'
  where a.id = p_assessment_id;

  insert into public.fire_exposures as fe (
    organization_id, assessment_id, incident_id, incident_name, discovered_at, acres,
    relation, source, recommendations_total, done_at_start, verified_at_start,
    immediate_outstanding_at_start, detected_by
  ) values (
    p_organization_id, p_assessment_id, btrim(p_incident_id), btrim(p_incident_name), p_discovered_at,
    p_acres, p_relation, p_source, coalesce(total, 0), coalesce(done, 0), coalesce(verified, 0),
    coalesce(immediate_open, 0), auth.uid()
  )
  on conflict (organization_id, assessment_id, incident_id) do update
    set incident_name = excluded.incident_name,
        acres = excluded.acres,
        relation = case when fe.relation = 'inside' then 'inside' else excluded.relation end,
        updated_at = now()
  returning * into e;
  return e;
end;
$$;

revoke all on function public.record_fire_exposure(uuid, uuid, text, text, timestamptz, numeric, text, text) from public, anon;
grant execute on function public.record_fire_exposure(uuid, uuid, text, text, timestamptz, numeric, text, text) to authenticated;
