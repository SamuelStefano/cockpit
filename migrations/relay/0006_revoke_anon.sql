-- No relay table is read or written by a signed-out client: every policy is keyed on
-- auth.uid(), and the backend uses service_role. The anon grants come from Supabase's
-- default privileges and only widen the blast radius of a future table created without RLS.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;
