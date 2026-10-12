-- Remove anon's EXECUTE on the verification functions.
--
-- 20261012100000 revoked EXECUTE from PUBLIC and granted it to authenticated,
-- but Supabase's default privileges also grant EXECUTE on new public-schema
-- functions to anon explicitly, and that grant survives a revoke from PUBLIC.
-- The functions already refuse anonymous callers (auth.uid() is null → 28000),
-- so this restores the intended second layer: anon cannot call them at all.

revoke execute on function public.verify_mitigation_action(uuid, uuid, text) from anon;
revoke execute on function public.revoke_mitigation_verification(uuid) from anon;
