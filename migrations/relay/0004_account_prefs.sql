-- Account-scoped UI prefs (DR-023 follow-up). Permission mode, model, effort and
-- the UI toggles lived only in browser localStorage, so the same person's phone
-- and desktop drifted apart: picking Opus on the desktop didn't reach the phone.
-- Move them onto the account row, written client-side under the existing
-- self-update RLS (id = auth.uid()) from 0002. Additive only — no drops, no data
-- loss, and an account that never syncs just keeps a null here.
--
-- One jsonb instead of a column per pref: the set of UI toggles changes with the
-- app, and a blob keeps every new switch from needing a migration. Nothing here is
-- privileged (is_admin/email stay guarded by guard_privileged_columns), so no new
-- policy or trigger is needed. Device-scoped state — drafts, the pairing token,
-- the WS url, the open session, seen markers, pending attachments — deliberately
-- stays in the browser and is NOT written here.

alter table public.account add column if not exists prefs jsonb;

-- Bound the size so a hostile or buggy client can't turn the account row into a
-- dump: the real payload is a handful of short scalars plus custom model ids.
do $$ begin
  alter table public.account add constraint account_prefs_len check (prefs is null or pg_column_size(prefs) <= 16384);
exception when duplicate_object then null; end $$;

-- Top-level object only. The client reads known keys off an object; an array or a
-- bare scalar in this column would be a client bug worth failing loudly on.
do $$ begin
  alter table public.account add constraint account_prefs_object check (prefs is null or jsonb_typeof(prefs) = 'object');
exception when duplicate_object then null; end $$;
