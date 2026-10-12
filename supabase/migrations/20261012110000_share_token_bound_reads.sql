-- Bind shared-report reads to the share token.
--
-- Before: shares_select_public let anyone list every unexpired shared_reports
-- row, access tokens included, so the token was not a secret. Worse,
-- assessment_is_shared(aid) only asked "does any live share exist?", so
-- `select * from assessments` as anon returned every assessment with a live
-- share — no token needed — and likewise its photos, annotations and
-- mitigation actions.
--
-- After: the shared /report/:token view sends its token in an `x-share-token`
-- request header (PostgREST exposes request headers as the `request.headers`
-- GUC). assessment_is_shared(aid) now matches only a live share for THAT
-- assessment carrying THAT token, so a reader sees exactly the one report
-- whose token they hold. The *_select_shared policies on assessments,
-- assessment_photos, map_annotations and mitigation_actions all go through
-- assessment_is_shared, so they are fixed by redefining it; no policy changes
-- are needed for them.

-- The share token sent with this request, or null. Lower-case key: PostgREST
-- lower-cases header names. nullif guards an empty GUC ('' is not valid json).
create or replace function public.request_share_token()
returns text language sql stable as $$
  select nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-share-token', '');
$$;

create or replace function public.assessment_is_shared(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shared_reports sr
    where sr.assessment_id = aid
      and sr.expires_at > now()
      and sr.access_token = public.request_share_token()
  );
$$;

-- shared_reports: no more public listing. The owner still manages their shares
-- (shares_all_own); a token holder can read only the share row they hold.
drop policy if exists "shares_select_public" on public.shared_reports;
create policy "shares_select_by_token" on public.shared_reports
  for select using (expires_at > now() and access_token = public.request_share_token());
