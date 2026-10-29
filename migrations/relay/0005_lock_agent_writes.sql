-- Lock direct writes on agent and pairing_code. 0001 gave `agent` a `for all`
-- policy, so any logged-in user could INSERT an agent row (kind='vps') with an
-- arbitrary Ed25519 public key, or un-revoke an agent, and the relay trusts any
-- agent row with kind='vps' and revoked_at is null. That bypassed the pairing flow.
-- Both tables are written ONLY by the relay (service_role, which bypasses RLS and
-- grants). The browser never touches them (verified: no .from('agent') or
-- .from('pairing_code') in src/); pairing codes are created via the relay endpoint.
-- Owners keep read access to their own rows. No-op for service_role.

drop policy if exists agent_self_all on public.agent;
drop policy if exists agent_self_read on public.agent;
create policy agent_self_read on public.agent
  for select using (account_id = auth.uid());

drop policy if exists pcode_self_insert on public.pairing_code;

revoke all on public.agent        from anon;
revoke all on public.pairing_code from anon;

revoke insert, update, delete, truncate on public.agent        from authenticated;
revoke insert, update, delete, truncate on public.pairing_code from authenticated;
grant select on public.agent        to authenticated;
grant select on public.pairing_code to authenticated;
