import type { DiagReport } from './store';

export interface DiagCliArgs { limit: number; email?: string; json: boolean; full: boolean }

export function parseDiagArgs(argv: string[]): DiagCliArgs {
  const out: DiagCliArgs = { limit: 20, json: false, full: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-n' || a === '--limit') out.limit = Number(argv[++i]) || 20;
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice(8)) || 20;
    else if (a === '--email') out.email = argv[++i];
    else if (a.startsWith('--email=')) out.email = a.slice(8);
    else if (a === '--json') out.json = true;
    else if (a === '--full') out.full = true;
  }
  out.limit = Math.max(1, Math.min(500, Math.floor(out.limit)));
  if (out.email) out.email = out.email.trim().toLowerCase();
  return out;
}

function line(r: DiagReport, email: string | undefined): string {
  const when = new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19);
  return [when, email ?? r.account_id, r.source, r.kind, r.box_id ? `box ${r.box_id.slice(0, 8)}` : '-', r.app_version ?? '-'].join('  ');
}

// One header line per report; --full adds the payload (events, lines) below it.
export function formatReports(rows: DiagReport[], emails: Map<string, string>, full: boolean): string {
  if (!rows.length) return 'no reports';
  return rows.map((r) => {
    const head = line(r, emails.get(r.account_id));
    if (!full) return head;
    return `${head}\n${JSON.stringify(r.payload, null, 2).split('\n').map((l) => `    ${l}`).join('\n')}`;
  }).join('\n');
}
