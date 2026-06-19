-- First-party usage analytics. Events are write-only for end users (insert
-- their own, never read); aggregate reporting is done via service-role-only
-- views (Supabase SQL Editor / a dashboard tool with a read-only role).
-- `properties` must stay PII-free (enums/ids/counts only).

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  event       text not null,
  properties  jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_event_idx      on public.analytics_events (event);
create index if not exists analytics_events_created_at_idx  on public.analytics_events (created_at);
create index if not exists analytics_events_user_id_idx     on public.analytics_events (user_id);

alter table public.analytics_events enable row level security;

-- Users may only insert their own events. No select policy → reads are denied
-- for anon/authenticated by default; the service role bypasses RLS.
create policy "analytics_insert_own" on public.analytics_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- ─── Aggregate reporting views (service-role only) ──────────────────────────
-- These deliberately combine domain state (assessments, training_progress)
-- with usage events so a dashboard reads one row / one table.

create or replace view public.analytics_usage_summary as
  select
    (select count(*) from public.assessments)                                        as assessments_total,
    (select count(*) from public.assessments where status = 'completed')             as assessments_completed,
    (select count(distinct user_id) from public.training_progress where completed)   as users_completed_training,
    (select count(*) from public.training_progress where completed)                  as lessons_completed,
    (select count(*) from public.analytics_events where event = 'ar_mitigation_identified') as ar_mitigations_identified,
    (select count(*) from public.analytics_events where event = 'map_opened')         as map_opens;

-- Per-event daily counts for time-series charts.
create or replace view public.analytics_event_daily as
  select event,
         date_trunc('day', created_at) as day,
         count(*)                      as count
  from public.analytics_events
  group by event, date_trunc('day', created_at)
  order by day desc, event;

-- Lock the views down to service_role (dashboards) — not exposed to app users.
revoke all on public.analytics_usage_summary from anon, authenticated;
revoke all on public.analytics_event_daily   from anon, authenticated;
grant select on public.analytics_usage_summary to service_role;
grant select on public.analytics_event_daily   to service_role;
