-- Organizations, roles, and third-party verification of mitigation actions
-- (WFCA Phase 2, MO-5 C5-2 "verified mitigation"; prerequisite for C5-3).
--
-- Model:
--   organizations          — fire agencies, local governments, insurers, NGOs.
--   organization_members   — (org, user, role). Roles: admin | inspector | viewer.
--                            Provisioned by service role only (no self-serve
--                            path to becoming an inspector).
--   assessment_submissions — a homeowner submits an assessment to one org.
--                            Members of that org can then READ the assessment.
--
-- Verification never goes through table writes: inspectors have no
-- insert/update policy on mitigation_actions. They call
-- verify_mitigation_action() / revoke_mitigation_verification(), SECURITY
-- DEFINER functions that check membership, the submission, the action's state,
-- and conflict of interest, then stamp verified_by / verified_at /
-- verifier_organization_id server-side. The owner policies from
-- 20261009100000_mitigation_actions.sql are unchanged: owners still cannot
-- verify, and a verified row stays locked to them.
--
-- Agency submissions deliberately do NOT use shared_reports: a shared_reports
-- row makes the assessment readable by anyone (assessment_is_shared), which is
-- right for a link share and wrong for "send this to my fire department".

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null
                check (kind in ('fire_agency', 'local_government', 'state_agency', 'insurer', 'ngo', 'other')),
  state_code  text check (state_code ~ '^[A-Z]{2}$'),  -- primary jurisdiction, optional
  created_at  timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             text not null check (role in ('admin', 'inspector', 'viewer')),
  created_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members (user_id);

create table if not exists public.assessment_submissions (
  id               uuid primary key default gen_random_uuid(),
  assessment_id    uuid not null references public.assessments(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  submitted_by     uuid references auth.users(id) on delete set null default auth.uid(),
  status           text not null default 'submitted'
                     check (status in ('submitted', 'in_review', 'closed')),
  submitted_at     timestamptz not null default now(),
  unique (assessment_id, organization_id)
);
create index if not exists assessment_submissions_org_idx on public.assessment_submissions (organization_id);

alter table public.mitigation_actions
  add column if not exists verifier_organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists verification_note text;

-- ─── Helper functions (RLS-bypassing, like 20260618130000_fix_rls_recursion) ─

-- Any member (admin / inspector / viewer) of an org the assessment was
-- submitted to may read it.
create or replace function public.user_can_review_assessment(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessment_submissions s
    join public.organization_members m on m.organization_id = s.organization_id
    where s.assessment_id = aid and m.user_id = auth.uid()
  );
$$;

create or replace function public.user_can_review_property(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessments a
    where a.property_id = pid and public.user_can_review_assessment(a.id)
  );
$$;

create or replace function public.user_is_org_member(oid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = oid and m.user_id = auth.uid()
  );
$$;

create or replace function public.user_is_org_admin(oid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = oid and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.organizations          enable row level security;
alter table public.organization_members   enable row level security;
alter table public.assessment_submissions enable row level security;

-- Organization names are public (agencies and carriers are public bodies), so
-- a homeowner can pick one and a shared report can show "Verified by …".
-- Writes are service role only.
create policy "organizations_select_all" on public.organizations
  for select using (true);

-- Memberships: a user sees their own; admins see their org's roster.
-- Writes are service role only.
create policy "org_members_select_own" on public.organization_members
  for select using (user_id = auth.uid());
create policy "org_members_select_admin" on public.organization_members
  for select using (public.user_is_org_admin(organization_id));

-- Submissions: the owner creates/reads/withdraws them; org members read theirs.
-- No update policy: status changes (in_review / closed) come with the agency
-- queue, through a function, so nobody can re-point a submission at another
-- assessment.
create policy "submissions_select_own" on public.assessment_submissions
  for select using (public.user_owns_assessment(assessment_id));
create policy "submissions_insert_own" on public.assessment_submissions
  for insert with check (
    public.user_owns_assessment(assessment_id)
    and submitted_by = auth.uid()
    and status = 'submitted'
  );
create policy "submissions_delete_own" on public.assessment_submissions
  for delete using (public.user_owns_assessment(assessment_id));
create policy "submissions_select_org" on public.assessment_submissions
  for select using (public.user_is_org_member(organization_id));

-- Read access for reviewers to everything the report shows. Read only: no
-- reviewer write policies on any of these tables.
create policy "properties_select_reviewer" on public.properties
  for select using (public.user_can_review_property(id));
create policy "assessments_select_reviewer" on public.assessments
  for select using (public.user_can_review_assessment(id));
create policy "photos_select_reviewer" on public.assessment_photos
  for select using (public.user_can_review_assessment(assessment_id));
create policy "annotations_select_reviewer" on public.map_annotations
  for select using (public.user_can_review_assessment(assessment_id));
create policy "mitigation_select_reviewer" on public.mitigation_actions
  for select using (public.user_can_review_assessment(assessment_id));

-- ─── Verification functions ─────────────────────────────────────────────────

create or replace function public.verify_mitigation_action(
  p_action_id uuid,
  p_organization_id uuid,
  p_note text default null
)
returns public.mitigation_actions
language plpgsql security definer set search_path = public as $$
declare
  r public.mitigation_actions;
begin
  if auth.uid() is null then
    raise exception 'Sign in to verify mitigations' using errcode = '28000';
  end if;

  select * into r from public.mitigation_actions where id = p_action_id for update;
  if not found then
    raise exception 'Mitigation not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.organization_members m
    join public.assessment_submissions s on s.organization_id = m.organization_id
    where m.user_id = auth.uid()
      and m.organization_id = p_organization_id
      and m.role in ('admin', 'inspector')
      and s.assessment_id = r.assessment_id
  ) then
    raise exception 'Not authorized to verify this mitigation' using errcode = '42501';
  end if;

  -- Conflict of interest: an inspector never verifies their own property.
  if public.user_owns_assessment(r.assessment_id) then
    raise exception 'You cannot verify mitigation on your own property' using errcode = '42501';
  end if;

  if r.status <> 'completed' then
    raise exception 'Only completed mitigations can be verified (status is %)', r.status
      using errcode = '22023';
  end if;

  update public.mitigation_actions
     set status = 'verified',
         verified_at = now(),
         verified_by = auth.uid(),
         verifier_organization_id = p_organization_id,
         verification_note = nullif(btrim(p_note), '')
   where id = p_action_id
  returning * into r;
  return r;
end;
$$;

-- Undo a verification (e.g. recorded against the wrong item). Only an
-- inspector/admin of the organization that verified it may revoke; the row
-- returns to 'completed' and unlocks for the owner.
create or replace function public.revoke_mitigation_verification(p_action_id uuid)
returns public.mitigation_actions
language plpgsql security definer set search_path = public as $$
declare
  r public.mitigation_actions;
begin
  if auth.uid() is null then
    raise exception 'Sign in to revoke a verification' using errcode = '28000';
  end if;

  select * into r from public.mitigation_actions where id = p_action_id for update;
  if not found then
    raise exception 'Mitigation not found' using errcode = 'P0002';
  end if;
  if r.status <> 'verified' then
    raise exception 'This mitigation is not verified' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid()
      and m.organization_id = r.verifier_organization_id
      and m.role in ('admin', 'inspector')
  ) then
    raise exception 'Only the verifying organization can revoke this verification' using errcode = '42501';
  end if;

  update public.mitigation_actions
     set status = 'completed',
         verified_at = null,
         verified_by = null,
         verifier_organization_id = null,
         verification_note = null
   where id = p_action_id
  returning * into r;
  return r;
end;
$$;

revoke all on function public.verify_mitigation_action(uuid, uuid, text) from public;
revoke all on function public.revoke_mitigation_verification(uuid) from public;
grant execute on function public.verify_mitigation_action(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_mitigation_verification(uuid) to authenticated;
