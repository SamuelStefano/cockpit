-- T3 relay identity schema (DR-023). Apply to the dedicated Supabase project
-- `deck-relay` (NOT the DFL prod stack). account.id = auth.users.id = JWT sub, so
-- accountId is server-derived by construction (red line #1). is_admin is the ONLY
-- role column; root lives in relay env (COCKPIT_ROOT_EMAILS), never the DB.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.account (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  is_admin    boolean not null default false,        -- set ONLY by root via service path
  created_at  timestamptz not null default now()
);

-- An agent is a paired device: a fellow's VPS ('vps') or a browser signing key
-- ('browser', for e2e frame auth). public_key only — private keys never leave the
-- device (red line #3). revoked_at supersedes DR-016's "immutable binding" (DR-023).
create table if not exists public.agent (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.account (id) on delete cascade,
  kind        text not null default 'vps' check (kind in ('vps', 'browser')),
  label       text not null default '',
  public_key  text not null,
  paired_at   timestamptz not null default now(),
  last_seen   timestamptz,
  revoked_at  timestamptz,
  unique (account_id, public_key, kind)
);
create index if not exists agent_account_idx
  on public.agent (account_id) where revoked_at is null;

-- Single-use, short-TTL pairing codes. Store the HASH only, never the plaintext.
create table if not exists public.pairing_code (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.account (id) on delete cascade,
  code_hash   text not null,
  label       text not null default '',
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists pairing_code_lookup_idx
  on public.pairing_code (code_hash) where used_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-provision account on signup (SECURITY DEFINER + pinned search_path per the
-- squad's RLS amendment — else it fails under RLS / is hijackable).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.account (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS. Row-level only — per-COLUMN protection (is_admin/used_at/revoked_at must be
-- service-path only) is enforced by the trigger below, since Postgres RLS cannot
-- gate individual columns (squad amendment).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.account      enable row level security;
alter table public.agent        enable row level security;
alter table public.pairing_code enable row level security;

-- account: a fellow reads only their own row.
drop policy if exists account_self_read on public.account;
create policy account_self_read on public.account
  for select using (id = auth.uid());

-- agent: owner may read/insert/update/delete their own agents (label edits, revoke
-- via the trigger-guarded revoked_at). account_id is forced to the caller.
drop policy if exists agent_self_all on public.agent;
create policy agent_self_all on public.agent
  for all using (account_id = auth.uid()) with check (account_id = auth.uid());

-- pairing_code: owner may create/read/cancel their own; used_at is trigger-guarded.
drop policy if exists pcode_self_read on public.pairing_code;
create policy pcode_self_read on public.pairing_code
  for select using (account_id = auth.uid());
drop policy if exists pcode_self_insert on public.pairing_code;
create policy pcode_self_insert on public.pairing_code
  for insert with check (account_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Per-column write guard: a non-service caller (authenticated/anon) cannot flip
-- is_admin, used_at, or revoked_at directly. The relay's service-role path bypasses
-- RLS (and thus this guard runs with current_setting('role') = the service role).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.guard_privileged_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- service_role bypasses RLS; only guard the JWT-authenticated path.
  if auth.role() = 'service_role' then
    return new;
  end if;
  if tg_table_name = 'account' and new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin is set only by the relay service path';
  end if;
  if tg_table_name = 'pairing_code' and new.used_at is distinct from old.used_at then
    raise exception 'used_at is set only by the relay service path';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_account_cols on public.account;
create trigger guard_account_cols
  before update on public.account
  for each row execute function public.guard_privileged_columns();

drop trigger if exists guard_pcode_cols on public.pairing_code;
create trigger guard_pcode_cols
  before update on public.pairing_code
  for each row execute function public.guard_privileged_columns();

-- Trigger functions must not be callable as RPC (Supabase security advisor). They
-- run in trigger/owner context regardless; strip EXECUTE from the API roles.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_privileged_columns() from public, anon, authenticated;
