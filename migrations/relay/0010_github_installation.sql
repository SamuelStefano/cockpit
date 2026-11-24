-- GitHub App installations linked to a Deck account. Rows are inserted only by the
-- github-app edge function (service role) after it verifies the user owns the
-- installation, so there is deliberately no INSERT/UPDATE policy.

create table if not exists public.github_installation (
  account_id uuid not null references public.account(id) on delete cascade,
  installation_id bigint not null,
  account_login text not null default '',
  created_at timestamptz not null default now(),
  primary key (account_id, installation_id)
);

alter table public.github_installation enable row level security;

revoke all on public.github_installation from anon;

drop policy if exists "github_installation_select_own" on public.github_installation;
create policy "github_installation_select_own" on public.github_installation
  for select to authenticated
  using (account_id = auth.uid());

drop policy if exists "github_installation_delete_own" on public.github_installation;
create policy "github_installation_delete_own" on public.github_installation
  for delete to authenticated
  using (account_id = auth.uid());
