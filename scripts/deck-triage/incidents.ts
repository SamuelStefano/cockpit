import type { DiagReport } from '../../ops/src/data.ts';

export const INCIDENT_WINDOW_MS = 15 * 60 * 1000;
const KEEP_REPORTS = 5;

export type IncidentState = 'pending' | 'escalated';

export interface Incident {
  id: string;
  kind: string;
  accountId: string;
  firstAt: number;
  lastAt: number;
  count: number;
  reports: DiagReport[];
  state: IncidentState;
  email: string | null;
}

export const reportMs = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

// Same kind + account within 15 min of the incident's last report = same incident.
// Incidents live across ticks: the gate re-evaluates pending ones until they escalate
// or go quiet.
export function createIncidentTracker(windowMs = INCIDENT_WINDOW_MS) {
  const open = new Map<string, Incident>();
  let seq = 0;
  return {
    ingest(reports: DiagReport[]): { opened: Incident[]; folded: number } {
      const opened: Incident[] = [];
      let folded = 0;
      const sorted = [...reports].sort((a, b) => reportMs(a.created_at) - reportMs(b.created_at));
      for (const r of sorted) {
        const key = `${r.account_id}|${r.kind}`;
        const at = reportMs(r.created_at);
        const cur = open.get(key);
        if (cur && at - cur.lastAt <= windowMs) {
          cur.lastAt = Math.max(cur.lastAt, at);
          cur.count++;
          cur.reports = [...cur.reports, r].slice(-KEEP_REPORTS);
          if (!opened.includes(cur)) folded++;
          continue;
        }
        const inc: Incident = { id: `${Date.now().toString(36).slice(-4)}${(++seq).toString(36)}`, kind: r.kind, accountId: r.account_id, firstAt: at, lastAt: at, count: 1, reports: [r], state: 'pending', email: null };
        open.set(key, inc);
        opened.push(inc);
      }
      return { opened, folded };
    },
    pending(): Incident[] {
      return [...open.values()].filter((i) => i.state === 'pending');
    },
    all(): Incident[] {
      return [...open.values()];
    },
    escalate(inc: Incident): void {
      inc.state = 'escalated';
    },
    // Quiet incidents close; a new report of the same key afterwards opens a fresh one.
    prune(nowMs: number): Incident[] {
      const closed: Incident[] = [];
      for (const [k, i] of open) if (nowMs - i.lastAt > windowMs) { open.delete(k); closed.push(i); }
      return closed;
    },
  };
}

export type IncidentTracker = ReturnType<typeof createIncidentTracker>;
