import { listDiagReports, supabaseStore } from '../src/store';
import { formatReports, parseDiagArgs } from '../src/diagCli';

// Operator CLI on the relay host: latest diagnostic reports (diag_reports, service role).
//   sudo sh -c 'set -a; . /etc/deck-relay/env; /opt/node22/bin/node /opt/deck-relay/diag-reports.mjs -n 20 --email x@y.com --full'
// From a checkout: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx relay/scripts/diag-reports.ts
async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { console.error('set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(2); }
  const args = parseDiagArgs(process.argv.slice(2));
  const cfg = { url, serviceKey };
  const accounts = await supabaseStore(cfg).listAccounts();
  const emails = new Map(accounts.map((a) => [a.id, a.email]));
  let accountId: string | undefined;
  if (args.email) {
    accountId = accounts.find((a) => a.email?.toLowerCase() === args.email)?.id;
    if (!accountId) { console.error(`no account with email ${args.email}`); process.exit(1); }
  }
  const rows = await listDiagReports(cfg, { limit: args.limit, accountId });
  if (args.json) { console.log(JSON.stringify(rows.map((r) => ({ ...r, email: emails.get(r.account_id) ?? null })), null, 2)); return; }
  console.log(formatReports(rows, emails, args.full));
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
