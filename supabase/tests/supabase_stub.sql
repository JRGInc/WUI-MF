-- Minimal stand-ins for the Supabase-managed auth and storage schemas, so the
-- migrations can run on plain Postgres. Roles are created by run-rls-tests.sh.
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
-- Supabase's default privileges: objects created in public by the migration
-- role are explicitly granted to anon/authenticated/service_role. Revoking
-- from PUBLIC does not remove these grants, so migrations must revoke from
-- anon explicitly; mirroring them here lets the tests catch that.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
