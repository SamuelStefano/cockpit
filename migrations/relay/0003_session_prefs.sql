-- Session prefs on account: favorites (pinned) and per-session tags lived only in
-- browser localStorage, so they didn't follow the account to another device. Move
-- them onto the account row, written client-side under the existing self-update
-- RLS (id = auth.uid()). Additive only — no drops, no data loss.
--
-- Session ids are stable per account (the same T3 agent backs every device of an
-- account), so pinning/tagging by session id is meaningful across devices.

alter table public.account add column if not exists pinned_sessions text[];
alter table public.account add column if not exists session_tags    jsonb;

-- Bound sizes so a hostile/buggy client can't bloat the row: a few hundred pins
-- and a tags map of a few hundred sessions cover any real use.
do $$ begin
  alter table public.account add constraint account_pinned_sessions_len check (pinned_sessions is null or array_length(pinned_sessions, 1) is null or array_length(pinned_sessions, 1) <= 500);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.account add constraint account_session_tags_len check (session_tags is null or pg_column_size(session_tags) <= 65536);
exception when duplicate_object then null; end $$;
