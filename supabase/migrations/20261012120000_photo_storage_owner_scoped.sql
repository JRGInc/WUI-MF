-- Scope assessment-photos Storage writes to the assessment's owner.
--
-- Before: photos_storage_insert/update/delete checked only the bucket, so any
-- signed-in user could overwrite or delete ANY photo object (including another
-- homeowner's evidence of completed mitigation), and photos_storage_select let
-- anyone list every object in the bucket.
--
-- Object paths are `<assessment id>/<photo id>.jpg` (syncPhoto in
-- offlineStorage.ts), so the first path segment names the assessment:
--   insert/update/delete — only the assessment's owner;
--   select (API listing/download) — the owner, or a reviewer of a submitted
--     assessment.
-- The bucket stays public: /object/public/ URLs (getPhotoUrl, the shared
-- report) bypass RLS by design and keep working; their object names are
-- unguessable uuids, and they are no longer listable.
-- The service role (training-data export) bypasses RLS as before.

-- The assessment id a storage object belongs to, or null for any other path
-- shape (checked before casting, so an odd name can't make the policy error).
create or replace function public.storage_object_assessment_id(object_name text)
returns uuid language sql immutable as $$
  select case
    when split_part(object_name, '/', 1)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

drop policy if exists "photos_storage_select" on storage.objects;
drop policy if exists "photos_storage_insert" on storage.objects;
drop policy if exists "photos_storage_update" on storage.objects;
drop policy if exists "photos_storage_delete" on storage.objects;

create policy "photos_storage_select" on storage.objects
  for select using (
    bucket_id = 'assessment-photos'
    and (
      public.user_owns_assessment(public.storage_object_assessment_id(name))
      or public.user_can_review_assessment(public.storage_object_assessment_id(name))
    )
  );

create policy "photos_storage_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'assessment-photos'
    and public.user_owns_assessment(public.storage_object_assessment_id(name))
  );

-- WITH CHECK too, so an owner can't move an object into someone else's folder.
create policy "photos_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'assessment-photos'
    and public.user_owns_assessment(public.storage_object_assessment_id(name))
  )
  with check (
    bucket_id = 'assessment-photos'
    and public.user_owns_assessment(public.storage_object_assessment_id(name))
  );

create policy "photos_storage_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'assessment-photos'
    and public.user_owns_assessment(public.storage_object_assessment_id(name))
  );
