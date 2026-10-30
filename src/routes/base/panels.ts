import type { Sim } from './sim';
import type { Crate, SimPrompt } from './sim-types';
import type { FunnelView, JourneyView, Ticket } from './hudState';

export const STAGES = ['code', 'tests', 'review', 'gate', 'merged', 'deployed', 'verified'];

const stageIdx = (j: SimPrompt['jobs'][number]) => (j.crate?.done ? 6 : Math.max(0, STAGES.indexOf(j.stage)));
const isBad = (j: SimPrompt['jobs'][number]) => !!(j.a?.blockers.size || j.a?.silent || j.crate?.held);

export function ticketsOf(s: Sim): Ticket[] {
  return s.prompts.map((p) => ({
    id: p.id, title: p.title.slice(0, 34), total: p.jobs.length, done: p.jobs.filter((j) => j.crate?.done).length,
    pips: p.jobs.map((j) => ({ value: (stageIdx(j) + 1) / 7, bad: isBad(j), ok: !!j.crate?.done })),
  }));
}

export function funnelOf(p: SimPrompt): FunnelView {
  return {
    title: p.title, total: p.jobs.length, done: p.jobs.filter((j) => j.crate?.done).length,
    branches: p.jobs.map((j) => ({
      name: j.a?.name ?? '', task: j.task, rework: j.rework ?? 0, bad: isBad(j), done: !!j.crate?.done,
      reach: j.crate?.done ? 8 : 2 + Math.max(0, STAGES.indexOf(j.stage)), crateId: j.crate?.id, agentId: j.a?.id,
    })),
  };
}

export function journeyOf(s: Sim, c: Crate): JourneyView {
  const planner = s.planner, t0 = c.job.prompt.t;
  const rows = [
    { t: t0, what: `Your prompt: ${c.job.prompt.title}` },
    ...planner.log.filter((l) => l.t >= t0).slice(0, 2).map((l) => ({ t: l.t, what: `${planner.name}: ${l.msg}` })),
    ...c.a.log.map((l) => ({ t: l.t, what: `${c.a.name}: ${l.msg}` })),
    ...c.trail,
  ].sort((a, b) => a.t - b.t);
  return { title: c.title, status: c.status, rows };
}

export interface FunnelPoint { x: number; y: number }
export const FUNNEL_COLS = ['Prompt', 'Plan', 'Agent', 'Tests', 'Review', 'Gate', 'Merged', 'Deployed', 'Verified'];
export const FUNNEL_W = 1100;
export const FUNNEL_H = 500;
export const funnelX = (i: number) => 60 + (i * (FUNNEL_W - 120)) / (FUNNEL_COLS.length - 1);

export function funnelRow(n: number, i: number) {
  const gap = Math.min(70, 360 / Math.max(n, 1)), top = 80 + (360 - gap * (n - 1)) / 2;
  return { y: top + i * gap, mid: top + ((n - 1) * gap) / 2 };
}

export function funnelSegment(k: number, y: number, mid: number): string {
  const X = funnelX;
  if (k === 0) return `M${X(0)} ${mid} L${X(1)} ${mid}`;
  if (k === 1) return `M${X(1)} ${mid} C${X(1) + 50} ${mid} ${X(2) - 50} ${y} ${X(2)} ${y}`;
  return `M${X(k)} ${y} L${X(k + 1)} ${y}`;
}
