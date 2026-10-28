import type { DiagReport } from '../../ops/src/data.ts';

export const INCIDENT_WINDOW_MS = 15 * 60 * 1000;

export interface Incident { id: string; kind: string; accountId: string; reports: DiagReport[] }

interface Open { id: string; lastAt: number }

const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

// Same kind + account within 15 min of the incident's last report = same incident.
// State spans ticks: a report folded into an incident already triaged produces nothing.
export function createIncidentTracker(windowMs = INCIDENT_WINDOW_MS) {
  const open = new Map<string, Open>();
  let seq = 0;
  return {
    ingest(reports: DiagReport[]): { fresh: Incident[]; folded: number } {
      const fresh = new Map<string, Incident>();
      let folded = 0;
      const sorted = [...reports].sort((a, b) => ms(a.created_at) - ms(b.created_at));
      for (const r of sorted) {
        const key = `${r.account_id}|${r.kind}`;
        const at = ms(r.created_at);
        const cur = open.get(key);
        if (cur && at - cur.lastAt <= windowMs) {
          cur.lastAt = Math.max(cur.lastAt, at);
          const f = fresh.get(key);
          if (f && f.id === cur.id) f.reports.push(r); else folded++;
          continue;
        }
        const id = `${Date.now().toString(36).slice(-4)}${(++seq).toString(36)}`;
        open.set(key, { id, lastAt: at });
        fresh.set(key, { id, kind: r.kind, accountId: r.account_id, reports: [r] });
      }
      const newest = Math.max(0, ...[...open.values()].map((o) => o.lastAt));
      for (const [k, o] of open) if (newest - o.lastAt > 4 * windowMs) open.delete(k);
      return { fresh: [...fresh.values()], folded };
    },
  };
}
