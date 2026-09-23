import type { AreaBudget, AreaId, TermStats } from './canvas';

// Pure aggregation + evaluation shared by the SERVER (the one authoritative
// computation — canvas-term-stats' response and the autopause loop both call
// this) and the client (which only EVALUATES the numbers the server sent it,
// never recomputes its own estimate — see useCanvasRoute's budgetStatus).
// Client and server used to each run their own approximation of "cpu of open
// terminals", which could show a different over/under-budget verdict than the
// one the autopause loop was actually acting on. `areaUsageFromIds` is now the
// one place that math happens, called with whichever id sets a given context
// has (the open ids a browser just polled with, or the running-sessions proxy
// the loop uses when nobody's specific poll list applies — see
// autopause-loop.ts for why the loop can't know what a browser has "open").
//
// ctxTokens sums the RUNNING sessions of the area (the live context window a
// turn is paying for right now); cpu sums the OPEN sessions/terminals of the
// area (whichever set the caller passes as `cpuIds`).
export interface AreaUsage { cpu: number; ctxTokens: number }

export function areaUsageFromIds(
  areaOf: ReadonlyMap<string, AreaId>, cpuIds: Iterable<string>, runningIds: ReadonlySet<string>, stats: Record<string, TermStats>,
): Partial<Record<AreaId, AreaUsage>> {
  const out: Partial<Record<AreaId, AreaUsage>> = {};
  const bump = (area: AreaId, cpu: number, ctxTokens: number) => {
    const cur = out[area] ?? { cpu: 0, ctxTokens: 0 };
    out[area] = { cpu: cur.cpu + cpu, ctxTokens: cur.ctxTokens + ctxTokens };
  };
  const seen = new Set<string>();
  for (const id of cpuIds) {
    if (seen.has(id)) continue; // a caller's open-ids list is not guaranteed deduped
    seen.add(id);
    const area = areaOf.get(id);
    const s = stats[id];
    if (!area || !s) continue;
    bump(area, s.cpu, 0);
  }
  for (const id of runningIds) {
    const area = areaOf.get(id);
    const s = stats[id];
    if (!area || !s || !s.contextTokens) continue;
    bump(area, 0, s.contextTokens);
  }
  return out;
}

export interface BudgetStatus { overCpu: boolean; overCtx: boolean; reasons: string[] }

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

export function evaluateBudget(usage: AreaUsage | undefined, budget: AreaBudget | undefined): BudgetStatus {
  const u = usage ?? { cpu: 0, ctxTokens: 0 };
  const overCpu = typeof budget?.cpu === 'number' && u.cpu > budget.cpu;
  const overCtx = typeof budget?.ctxTokens === 'number' && u.ctxTokens > budget.ctxTokens;
  const reasons: string[] = [];
  if (overCpu) reasons.push(`cpu ${fmt(u.cpu)}% > ${fmt(budget!.cpu!)}%`);
  if (overCtx) reasons.push(`contexto ${fmt(u.ctxTokens)} > ${fmt(budget!.ctxTokens!)}`);
  return { overCpu, overCtx, reasons };
}
