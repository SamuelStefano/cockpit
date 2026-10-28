-- Identified diagnostic reports. On 2026-10-28 two accounts were locked out for
-- hours and the only way to learn why was digging through servers. The Deck now
-- files a report when a failure persists (relay unreachable, login refused, box
-- offline, handshake unanswered, JS errors) and the agent files one after a crash
-- or a failed self-update. The admin reads them with the service role (relay CLI
-- and a separate admin app); a signed-in user can only add rows about themselves.
--
-- Thin on purpose: no function, no trigger. Size and shape are bounded by checks;
-- redaction and rate limits live in the TypeScript that writes the rows.

create table if not exists public.diag_reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  account_id  uuid not null default auth.uid() references public.account (id) on delete cascade,
  source      text not null check (source in ('browser', 'agent', 'relay')),
  kind        text not null check (char_length(kind) between 1 and 40),
  box_id      text check (box_id is null or char_length(box_id) <= 64),
  app_version text check (app_version is null or char_length(app_version) <= 120),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 400),
  payload     jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 64000)
);

create index if not exists diag_reports_created_at_idx on public.diag_reports (created_at desc);
create index if not exists diag_reports_account_created_idx on public.diag_reports (account_id, created_at desc);

alter table public.diag_reports enable row level security;

-- Insert-only for the signed-in user, and only about their own account. No select,
-- update or delete policy: the user cannot read back or tamper with reports, and
-- the admin reads through the service role, which bypasses RLS.
drop policy if exists diag_reports_self_insert on public.diag_reports;
create policy diag_reports_self_insert on public.diag_reports
  for insert to authenticated
  with check (account_id = auth.uid() and source = 'browser');

revoke all on table public.diag_reports from anon, public;
revoke all on table public.diag_reports from authenticated;
grant insert on table public.diag_reports to authenticated;
