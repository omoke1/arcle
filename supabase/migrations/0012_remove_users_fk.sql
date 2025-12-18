-- Remove Foreign Key constraint on public.users.id
-- This allows creating "anonymous" users in the users table who don't have a corresponding auth.users record.
-- Required for the "unlinked user" flow in getOrCreateSupabaseUser.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
