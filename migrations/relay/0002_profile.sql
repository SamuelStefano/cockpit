-- Profile fields on account (DR-023 follow-up). The profile (display name, avatar,
-- AI icon) lived only in browser localStorage, so it didn't follow the account
-- across devices/IPs. Move it onto the account row, written client-side under RLS
-- scoped to auth.uid(). Additive only — no drops, no data loss.

alter table public.account add column if not exists display_name text;
alter table public.account add column if not exists avatar_url   text;
alter table public.account add column if not exists ai_avatar    text;

-- Bound sizes: the avatar is a 96px JPEG data URL (~a few KB); cap generously to
-- keep a hostile client from bloating the row. Names/icon ids are tiny.
do $$ begin
  alter table public.account add constraint account_display_name_len check (display_name is null or char_length(display_name) <= 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.account add constraint account_avatar_url_len check (avatar_url is null or char_length(avatar_url) <= 100000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.account add constraint account_ai_avatar_len check (ai_avatar is null or char_length(ai_avatar) <= 40);
exception when duplicate_object then null; end $$;

-- A fellow may now update their OWN row (profile edits). Per-column protection of
-- is_admin (and now email) stays enforced by guard_account_cols below — RLS can't
-- gate columns. with check pins the row to the caller so they can't reassign it.
drop policy if exists account_self_update on public.account;
create policy account_self_update on public.account
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Extend the per-column write guard: with self-update now allowed, also stop the
-- authenticated path from rewriting email (identity field set at signup). is_admin
-- was already guarded. service_role bypasses RLS and this guard (relay service path).
create or replace function public.guard_privileged_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if tg_table_name = 'account' and new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin is set only by the relay service path';
  end if;
  if tg_table_name = 'account' and new.email is distinct from old.email then
    raise exception 'email is set only by the relay service path';
  end if;
  if tg_table_name = 'pairing_code' and new.used_at is distinct from old.used_at then
    raise exception 'used_at is set only by the relay service path';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_privileged_columns() from public, anon, authenticated;
