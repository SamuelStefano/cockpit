import type { AreaBudget, AreaId, TermStats } from './canvas';

// Pure aggregation shared by the SERVER (the one authoritative computation —
// canvas-term-stats' reply and the autopause loop both call this over the
// exact same id set) and the client (which only EVALUATES the number the
// server sent it, via evaluateBudget below — never recomputes its own, see
// useCanvasRoute's budgetStatus). Client and server used to each run their
// own approximation ("cpu of MY open windows" vs. "cpu of every running
// session"), which could show the user a different over/under-budget verdict
// than the one the autopause loop was actually acting on (review #595 second
// pass, point 4) — there is now exactly one definition: sum, over every
// RUNNING session of the area, its cpu (claude tree + tmux pane —
// server/canvas/term-stats.ts) and its context tokens. `sessionIds` is that
// one running-session id set; the caller decides what "running" means
// (server/ws/threads.ts's `threads`, both call sites).
export interface AreaUsage { cpu: number; ctxTokens: number }

export function areaUsageFromIds(
  areaOf: ReadonlyMap<string, AreaId>, sessionIds: Iterable<string>, stats: Record<string, TermStats>,
): Partial<Record<AreaId, AreaUsage>> {
  const out: Partial<Record<AreaId, AreaUsage>> = {};
  const seen = new Set<string>();
  for (const id of sessionIds) {
    if (seen.has(id)) continue; // a caller's id list is not guaranteed deduped
    seen.add(id);
    const area = areaOf.get(id);
    const s = stats[id];
    if (!area || !s) continue;
    const cur = out[area] ?? { cpu: 0, ctxTokens: 0 };
    out[area] = { cpu: cur.cpu + s.cpu, ctxTokens: cur.ctxTokens + (s.contextTokens ?? 0) };
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
