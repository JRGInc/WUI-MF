-- Fix: "infinite recursion detected in policy" between assessments ↔ shared_reports
-- (and the photos/annotations policies that traverse assessments).
--
-- Root cause: a policy subquery against another table is itself evaluated under
-- THAT table's RLS. assessments→shared_reports→assessments forms a cycle.
-- Fix: do the cross-table checks inside SECURITY DEFINER functions, which run
-- with the definer's rights and bypass RLS, so no policy re-triggers another.

-- ─── Helper functions (RLS-bypassing) ───────────────────────────────────────

create or replace function public.user_owns_property(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.properties p
    where p.id = pid and p.user_id = auth.uid()
  );
$$;

create or replace function public.user_owns_assessment(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessments a
    join public.properties p on p.id = a.property_id
    where a.id = aid and p.user_id = auth.uid()
  );
$$;

create or replace function public.assessment_is_shared(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shared_reports sr
    where sr.assessment_id = aid and sr.expires_at > now()
  );
$$;

-- ─── Recreate the cross-table policies using the helpers ─────────────────────

-- assessments
drop policy if exists "assessments_all_own"       on public.assessments;
drop policy if exists "assessments_select_shared" on public.assessments;
create policy "assessments_all_own" on public.assessments
  for all using (public.user_owns_property(property_id))
  with check (public.user_owns_property(property_id));
create policy "assessments_select_shared" on public.assessments
  for select using (public.assessment_is_shared(id));

-- assessment_photos
drop policy if exists "photos_all_own"       on public.assessment_photos;
drop policy if exists "photos_select_shared" on public.assessment_photos;
create policy "photos_all_own" on public.assessment_photos
  for all using (public.user_owns_assessment(assessment_id))
  with check (public.user_owns_assessment(assessment_id));
create policy "photos_select_shared" on public.assessment_photos
  for select using (public.assessment_is_shared(assessment_id));

-- map_annotations
drop policy if exists "annotations_all_own"       on public.map_annotations;
drop policy if exists "annotations_select_shared" on public.map_annotations;
create policy "annotations_all_own" on public.map_annotations
  for all using (public.user_owns_assessment(assessment_id))
  with check (public.user_owns_assessment(assessment_id));
create policy "annotations_select_shared" on public.map_annotations
  for select using (public.assessment_is_shared(assessment_id));

-- shared_reports
drop policy if exists "shares_all_own"       on public.shared_reports;
drop policy if exists "shares_select_public" on public.shared_reports;
create policy "shares_all_own" on public.shared_reports
  for all using (public.user_owns_assessment(assessment_id))
  with check (public.user_owns_assessment(assessment_id));
create policy "shares_select_public" on public.shared_reports
  for select using (expires_at > now());
