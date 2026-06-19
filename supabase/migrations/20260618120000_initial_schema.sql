-- WUI-MF wildfire risk assessment — initial Supabase schema
-- Tables mirror src/shared/types/database.ts (snake_case rows).
-- Run via the Supabase SQL Editor (paste whole file) or `supabase db push`.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  address     text,
  created_at  timestamptz not null default now()
);

create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  address     text not null,
  coordinates jsonb,
  parcel_id   text,
  created_at  timestamptz not null default now()
);
create index if not exists properties_user_id_idx on public.properties (user_id);

create table if not exists public.assessments (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  status          text not null default 'in_progress',
  overall_score   numeric,
  category_scores jsonb,
  findings        jsonb,
  recommendations jsonb,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index if not exists assessments_property_id_idx on public.assessments (property_id);

create table if not exists public.assessment_photos (
  id               uuid primary key default gen_random_uuid(),
  assessment_id    uuid not null references public.assessments(id) on delete cascade,
  storage_path     text not null,
  category         text,
  analysis_results jsonb,
  coordinates      jsonb,
  captured_at      timestamptz not null default now(),
  training_consent boolean default false,
  hazard_tags      text[] default '{}'
);
create index if not exists assessment_photos_assessment_id_idx on public.assessment_photos (assessment_id);
create index if not exists assessment_photos_hazard_tags_idx on public.assessment_photos using gin (hazard_tags);

create table if not exists public.map_annotations (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  coordinates     jsonb not null,
  annotation_type text not null,
  content         jsonb not null,
  created_at      timestamptz not null default now()
);
create index if not exists map_annotations_assessment_id_idx on public.map_annotations (assessment_id);

create table if not exists public.shared_reports (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  share_type      text not null,
  recipient_email text,
  access_token    text not null unique,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);
create index if not exists shared_reports_access_token_idx on public.shared_reports (access_token);

create table if not exists public.training_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    text not null,
  completed    boolean not null default false,
  quiz_score   numeric,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);
create index if not exists training_progress_user_id_idx on public.training_progress (user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Auto-create a profile row when a user signs up
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.properties        enable row level security;
alter table public.assessments       enable row level security;
alter table public.assessment_photos enable row level security;
alter table public.map_annotations   enable row level security;
alter table public.shared_reports    enable row level security;
alter table public.training_progress enable row level security;

-- profiles: a user owns their own row
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- properties: owned by user_id
create policy "properties_all_own" on public.properties
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- assessments: owned via property → user
create policy "assessments_all_own" on public.assessments
  for all using (exists (
    select 1 from public.properties p
    where p.id = assessments.property_id and p.user_id = auth.uid()))
  with check (exists (
    select 1 from public.properties p
    where p.id = assessments.property_id and p.user_id = auth.uid()));

-- assessments: public read when a non-expired share points at it (the /report/:token view)
create policy "assessments_select_shared" on public.assessments
  for select using (exists (
    select 1 from public.shared_reports sr
    where sr.assessment_id = assessments.id and sr.expires_at > now()));

-- assessment_photos: owned via assessment → property → user
create policy "photos_all_own" on public.assessment_photos
  for all using (exists (
    select 1 from public.assessments a
    join public.properties p on p.id = a.property_id
    where a.id = assessment_photos.assessment_id and p.user_id = auth.uid()))
  with check (exists (
    select 1 from public.assessments a
    join public.properties p on p.id = a.property_id
    where a.id = assessment_photos.assessment_id and p.user_id = auth.uid()));
create policy "photos_select_shared" on public.assessment_photos
  for select using (exists (
    select 1 from public.shared_reports sr
    where sr.assessment_id = assessment_photos.assessment_id and sr.expires_at > now()));

-- map_annotations: same ownership chain
create policy "annotations_all_own" on public.map_annotations
  for all using (exists (
    select 1 from public.assessments a
    join public.properties p on p.id = a.property_id
    where a.id = map_annotations.assessment_id and p.user_id = auth.uid()))
  with check (exists (
    select 1 from public.assessments a
    join public.properties p on p.id = a.property_id
    where a.id = map_annotations.assessment_id and p.user_id = auth.uid()));
create policy "annotations_select_shared" on public.map_annotations
  for select using (exists (
    select 1 from public.shared_reports sr
    where sr.assessment_id = map_annotations.assessment_id and sr.expires_at > now()));

-- shared_reports: owner manages; non-expired rows are publicly readable (token is the secret)
create policy "shares_all_own" on public.shared_reports
  for all using (exists (
    select 1 from public.assessments a
    join public.properties p on p.id = a.property_id
    where a.id = shared_reports.assessment_id and p.user_id = auth.uid()))
  with check (exists (
    select 1 from public.assessments a
    join public.properties p on p.id = a.property_id
    where a.id = shared_reports.assessment_id and p.user_id = auth.uid()));
create policy "shares_select_public" on public.shared_reports
  for select using (expires_at > now());

-- training_progress: owned by user_id
create policy "training_all_own" on public.training_progress
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: assessment-photos bucket
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('assessment-photos', 'assessment-photos', true)
on conflict (id) do nothing;

create policy "photos_storage_select" on storage.objects
  for select using (bucket_id = 'assessment-photos');
create policy "photos_storage_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'assessment-photos');
create policy "photos_storage_update" on storage.objects
  for update to authenticated using (bucket_id = 'assessment-photos');
create policy "photos_storage_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'assessment-photos');
