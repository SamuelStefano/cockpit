import { readFile, rename, writeFile } from 'node:fs/promises';
import type { DiagReport } from '../../ops/src/data.ts';
import { ssh, type Runner, type SshTarget } from './exec.ts';
import { isUuid } from './sanitize.ts';

const ENV = '/home/ubuntu/cockpit/.env.relay';
const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const BATCH = 200;

// The service role key stays on the relay host: it is sourced there and handed to
// curl on stdin (`-H @-`), so it is in neither this machine nor any argv.
const AUTH_CURL = `printf 'apikey: %s\\nAuthorization: Bearer %s\\n' "$SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" | curl -sS -f -m 15 -H @-`;

export function reportsScript(sinceIso: string): string {
  if (!ISO_MS.test(sinceIso)) throw new Error('cursor must be an ISO timestamp with ms');
  return [
    'set -eu',
    `set -a; . ${ENV}; set +a`,
    `${AUTH_CURL} "$SUPABASE_URL/rest/v1/diag_reports?select=*&created_at=gte.${sinceIso}&order=created_at.asc,id.asc&limit=${BATCH}"`,
  ].join('\n');
}

// One ssh round trip for every relay-local check, sections separated by markers.
export function probeScript(accountId: string | null): string {
  const acc = accountId && isUuid(accountId) ? accountId : '';
  return [
    'set -u',
    `set -a; . ${ENV} 2>/dev/null; set +a`,
    'echo "@@status"; curl -sS -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:8800/status || echo "000"',
    'echo; echo "@@relay"; systemctl is-active deck-relay',
    'echo "@@caddy"; systemctl is-active caddy',
    `ACC='${acc}'`,
    'if [ -n "$ACC" ] && [ -n "${DECK_LOG_SALT:-}" ]; then',
    '  H=$(node -e \'process.stdout.write(require("crypto").createHmac("sha256",process.env.DECK_LOG_SALT).update(process.argv[1]).digest("hex").slice(0,10))\' "$ACC")',
    '  echo "@@log"; journalctl -u deck-relay -n 5000 -o cat --no-pager 2>/dev/null | grep -F "\\"acct\\":\\"$H\\"" | tail -n 50',
    `  echo "@@agents"; ${AUTH_CURL} "$SUPABASE_URL/rest/v1/agent?select=id,label,kind,last_seen,revoked_at&account_id=eq.$ACC&order=last_seen.desc.nullslast&limit=10" || echo "[]"; echo`,
    'else',
    '  echo "@@log"; journalctl -u deck-relay -n 50 -o cat --no-pager 2>/dev/null',
    'fi',
    'echo "@@end"',
  ].join('\n');
}

export function parseSections(out: string): Record<string, string> {
  const res: Record<string, string> = {};
  let cur: string | null = null;
  const buf: string[] = [];
  const flush = () => { if (cur) res[cur] = buf.join('\n').trim(); buf.length = 0; };
  for (const line of out.split('\n')) {
    const m = /^@@([a-z]+)$/.exec(line.trim());
    if (m) { flush(); cur = m[1]; continue; }
    if (cur) buf.push(line);
  }
  flush();
  return res;
}

export interface Cursor { at: string; ids: string[] }

export const toMsIso = (iso: string): string => new Date(iso).toISOString();

// PostgREST returns microseconds; the cursor keeps ms precision, so every id seen at
// that truncated instant is remembered to keep the `gte` re-read from repeating it.
export function advanceCursor(cur: Cursor, rows: DiagReport[]): Cursor {
  let next = cur;
  for (const r of rows) {
    const at = toMsIso(r.created_at);
    next = at === next.at ? { at, ids: [...next.ids, r.id] } : at > next.at ? { at, ids: [r.id] } : next;
  }
  return next;
}

export async function fetchNewReports(runner: Runner, target: SshTarget, cur: Cursor): Promise<DiagReport[]> {
  const res = await ssh(runner, target, reportsScript(cur.at), 30_000);
  if (res.code !== 0) throw new Error(`relay reports: exit ${res.code}${res.timedOut ? ' (timeout)' : ''} ${res.stderr.trim().slice(0, 200)}`);
  const rows = JSON.parse(res.stdout) as DiagReport[];
  if (!Array.isArray(rows)) throw new Error('relay reports: not an array');
  const seen = new Set(cur.ids);
  return rows.filter((r) => isUuid(r?.id) && !seen.has(r.id) && !Number.isNaN(Date.parse(r.created_at)));
}

export function fileCursor(path: string) {
  return {
    async load(): Promise<Cursor | null> {
      try {
        const c = JSON.parse(await readFile(path, 'utf8')) as Cursor;
        return typeof c?.at === 'string' && ISO_MS.test(c.at) && Array.isArray(c.ids) ? c : null;
      } catch { return null; }
    },
    async save(c: Cursor): Promise<void> {
      await writeFile(`${path}.tmp`, JSON.stringify(c));
      await rename(`${path}.tmp`, path);
    },
  };
}

export function emailsScript(accountIds: string[]): string {
  const ids = accountIds.filter(isUuid);
  return [
    'set -u',
    `set -a; . ${ENV}; set +a`,
    `for id in ${ids.join(' ')}; do`,
    `  printf '%s\\t' "$id"; ${AUTH_CURL} "$SUPABASE_URL/auth/v1/admin/users/$id" | tr -d '\\n' || true; echo`,
    'done',
  ].join('\n');
}

export function parseEmails(out: string): Map<string, string> {
  const res = new Map<string, string>();
  for (const line of out.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const id = line.slice(0, tab);
    if (!isUuid(id)) continue;
    try {
      const email = (JSON.parse(line.slice(tab + 1)) as { email?: unknown }).email;
      if (typeof email === 'string' && email.length <= 254) res.set(id, email.trim().toLowerCase());
    } catch { /* user missing or curl failed: stays unresolved */ }
  }
  return res;
}

export async function fetchEmails(runner: Runner, target: SshTarget, accountIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(accountIds.filter(isUuid))];
  if (!ids.length) return new Map();
  const res = await ssh(runner, target, emailsScript(ids), 30_000);
  return parseEmails(res.stdout);
}
