-- Mitigation tracking (WFCA Phase 2, MO-5 C5-2: "track completed and planned
-- mitigation" per parcel). One row per (assessment, recommendation): the
-- homeowner/inspector's progress on acting on that recommendation.
--
-- Status lifecycle: planned → in_progress → completed → verified.
-- 'verified' is reserved for a third party (inspector / agency). Until roles
-- land (organizations + memberships workstream), NO end user can set it: the
-- owner policies below reject verified rows and lock a row once verified, so a
-- homeowner can never self-verify. Verification is written by service role
-- today and by an inspector policy later.

create table if not exists public.mitigation_actions (
  id                  uuid primary key,  -- deterministic v5(assessment_id, recommendation_id) on the client
  assessment_id       uuid not null references public.assessments(id) on delete cascade,
  recommendation_id   text not null,
  category            text not null,
  priority            text,
  title               text not null,     -- snapshot of the recommendation title at the time of action
  status              text not null
                        check (status in ('planned', 'in_progress', 'completed', 'verified')),
  notes               text,
  evidence_photo_ids  text[] not null default '{}',
  completed_at        timestamptz,
  verified_at         timestamptz,
  verified_by         uuid references auth.users(id) on delete set null,
  created_by          uuid references auth.users(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (assessment_id, recommendation_id)
);

create index if not exists mitigation_actions_assessment_idx on public.mitigation_actions (assessment_id);
create index if not exists mitigation_actions_status_idx     on public.mitigation_actions (status);

-- Server-side updated_at so the audit trail does not depend on device clocks.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mitigation_actions_touch on public.mitigation_actions;
create trigger mitigation_actions_touch
  before insert or update on public.mitigation_actions
  for each row execute function public.touch_updated_at();

alter table public.mitigation_actions enable row level security;

-- Uses the SECURITY DEFINER helpers from 20260618130000_fix_rls_recursion.sql
-- so these policies never recurse through another table's RLS.

create policy "mitigation_select_own" on public.mitigation_actions
  for select using (public.user_owns_assessment(assessment_id));

create policy "mitigation_select_shared" on public.mitigation_actions
  for select using (public.assessment_is_shared(assessment_id));

create policy "mitigation_insert_own" on public.mitigation_actions
  for insert with check (
    public.user_owns_assessment(assessment_id)
    and status <> 'verified' and verified_at is null and verified_by is null
  );

create policy "mitigation_update_own" on public.mitigation_actions
  for update
  using (public.user_owns_assessment(assessment_id) and status <> 'verified')
  with check (
    public.user_owns_assessment(assessment_id)
    and status <> 'verified' and verified_at is null and verified_by is null
  );

create policy "mitigation_delete_own" on public.mitigation_actions
  for delete using (public.user_owns_assessment(assessment_id) and status <> 'verified');

-- Usage summary: append the mitigation counts the Phase 2 performance measures
-- ask for ("number of homeowner mitigations implemented", "% mitigation
-- activities logged"). New columns must be appended for CREATE OR REPLACE VIEW.
create or replace view public.analytics_usage_summary as
  select
    (select count(*) from public.assessments)                                        as assessments_total,
    (select count(*) from public.assessments where status = 'completed')             as assessments_completed,
    (select count(distinct user_id) from public.training_progress where completed)   as users_completed_training,
    (select count(*) from public.training_progress where completed)                  as lessons_completed,
    (select count(*) from public.analytics_events where event = 'ar_mitigation_identified') as ar_mitigations_identified,
    (select count(*) from public.analytics_events where event = 'map_opened')         as map_opens,
    (select count(*) from public.mitigation_actions)                                  as mitigations_logged,
    (select count(*) from public.mitigation_actions where status in ('completed', 'verified')) as mitigations_completed,
    (select count(*) from public.mitigation_actions where status = 'verified')        as mitigations_verified;

revoke all on public.analytics_usage_summary from anon, authenticated;
grant select on public.analytics_usage_summary to service_role;
