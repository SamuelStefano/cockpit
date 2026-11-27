import { HEAVY_LIMITS, HUMAN, isActive, type ExecutorState, type HeavyJob, type HeavyStatus, type JobInput } from '../../../../shared/heavy-job';

export const EXECUTOR_ACCENT = '#38bdf8';

export const STATUS_LABEL: Record<HeavyStatus, string> = {
  queued: 'Na fila',
  running: 'Rodando',
  done: 'Concluído',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

export const STATUS_TONE: Record<HeavyStatus, string> = {
  queued: '#fbbf24',
  running: EXECUTOR_ACCENT,
  done: '#4ade80',
  failed: '#f87171',
  cancelled: '#a3a3a3',
};

export const NOT_CONFIGURED_HINT = 'O executor é configurado em ~/.cockpit/executor.json na máquina do Deck.';

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
}

export function jobDuration(j: Pick<HeavyJob, 'startedAt' | 'endedAt'>, now: number): string | null {
  if (j.startedAt === undefined) return null;
  return formatDuration((j.endedAt ?? now) - j.startedAt);
}

export function stalledMinutes(state: ExecutorState, now: number): number | null {
  return state.stalledSince === undefined ? null : Math.max(1, Math.floor((now - state.stalledSince) / 60_000));
}

export function checkedAgo(state: ExecutorState, now: number): string | null {
  if (state.checkedAt === undefined) return null;
  const s = Math.max(0, Math.round((now - state.checkedAt) / 1000));
  if (s < 60) return 'verificado agora há pouco';
  return `verificado há ${Math.floor(s / 60)} min`;
}

export function queuedCount(jobs: HeavyJob[]): number {
  return jobs.filter(isActive).length;
}

export function stateLabel(state: ExecutorState): string {
  if (!state.configured) return 'não configurado';
  return state.online === null ? 'sem verificação' : state.online ? 'online' : 'offline';
}

// The Office chip exists only while the executor is configured.
export function executorChip(state: ExecutorState | undefined, jobs: HeavyJob[] = []): string | null {
  if (!state?.configured) return null;
  const n = queuedCount(jobs);
  const base = state.online === null ? state.label : `${state.label} ${state.online ? 'online' : 'offline'}`;
  return n > 0 ? `${base} · ${n} na fila` : base;
}

export function formBlock(canEdit: boolean, configured: boolean): string | null {
  if (!canEdit) return 'Só o admin roda trabalho no executor';
  if (!configured) return 'O executor não está configurado';
  return null;
}

export type RunFields = { repo: string; branch: string; dir: string; command: string };

export function submitBlock(f: RunFields): string | null {
  if (!f.repo.trim()) return 'Informe o repositório';
  if (!f.branch.trim()) return 'Informe a branch';
  if (!f.command.trim()) return 'Informe o comando';
  return null;
}

export function toInput(f: RunFields): JobInput {
  const dir = f.dir.trim();
  return { repo: f.repo.trim(), branch: f.branch.trim(), ...(dir ? { dir } : {}), command: f.command.trim() };
}

export const FIELD_MAX = HEAVY_LIMITS;
export const isHuman = (j: Pick<HeavyJob, 'requestedBy'>): boolean => j.requestedBy === HUMAN;
