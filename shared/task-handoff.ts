import { PLANNER_LIMITS, type PlannerTask, type TaskHandoff } from './planner';

export type HandoffResult = { ok: true; task: PlannerTask } | { ok: false; reason: string };

const TEXT_FIELDS = ['done', 'pending', 'reason', 'switchPoint'] as const;
const clip = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, PLANNER_LIMITS.handoffText) : '');

export function assignOwner(task: PlannerTask, botId: string | undefined, now: number): PlannerTask {
  const next: PlannerTask = { ...task, updatedAt: now };
  if (botId) next.ownerBotId = botId;
  else delete next.ownerBotId;
  return next;
}

export function applyHandoff(task: PlannerTask, handoff: TaskHandoff): HandoffResult {
  const clean = sanitizeHandoff(handoff);
  if (!clean) return { ok: false, reason: 'passagem incompleta: done, pending, reason e switchPoint são obrigatórios' };
  if (clean.toBotId === task.ownerBotId) return { ok: false, reason: 'o destinatário já é o dono da tarefa' };
  const handoffs = [...(task.handoffs ?? []), clean].slice(-PLANNER_LIMITS.handoffs);
  const { claim: _claim, ready: _ready, readyBy: _by, readyAt: _at, ...rest } = task;
  return { ok: true, task: { ...rest, ownerBotId: clean.toBotId, handoffs, updatedAt: clean.at } };
}

export function sanitizeHandoff(raw: unknown): TaskHandoff | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.toBotId !== 'string' || !r.toBotId.trim()) return null;
  if (typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  const text = {} as Record<(typeof TEXT_FIELDS)[number], string>;
  for (const f of TEXT_FIELDS) {
    text[f] = clip(r[f]);
    if (!text[f]) return null;
  }
  const out: TaskHandoff = { at: r.at, toBotId: r.toBotId.trim(), ...text };
  if (typeof r.fromBotId === 'string' && r.fromBotId.trim()) out.fromBotId = r.fromBotId.trim();
  return out;
}

export function sanitizeHandoffs(raw: unknown): TaskHandoff[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskHandoff[] = [];
  for (const h of raw) {
    const clean = sanitizeHandoff(h);
    if (clean) out.push(clean);
  }
  return out.slice(-PLANNER_LIMITS.handoffs);
}

export function handoffNote(h: TaskHandoff, nameOf: (id: string) => string): string {
  const from = h.fromBotId ? nameOf(h.fromBotId) : 'Sem dono';
  return [
    `${from} passou para ${nameOf(h.toBotId)}`,
    `Feito: ${h.done}`,
    `Falta: ${h.pending}`,
    `Por que troca de mão: ${h.reason}`,
    `Ponto da troca: ${h.switchPoint}`,
  ].join('\n');
}
