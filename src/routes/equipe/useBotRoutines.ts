import { useEffect, useState } from 'react';
import type { Cron, CronSchedule } from '../../../shared/protocol';
import { MIN_BOT_ROUTINE_MINUTES, routinesOf } from '../../../shared/bot-routine';

const NOW_TICK_MS = 30_000;

export interface RoutineDraft {
  name: string;
  prompt: string;
  kind: 'interval' | 'daily';
  everyMinutes: number;
  time: string;
}

export const emptyRoutineDraft = (): RoutineDraft => ({ name: '', prompt: '', kind: 'interval', everyMinutes: 60, time: '09:00' });

export function routineSchedule(d: RoutineDraft): CronSchedule {
  if (d.kind === 'interval') return { kind: 'interval', everyMinutes: d.everyMinutes };
  const [h, m] = d.time.split(':').map((x) => parseInt(x, 10));
  return { kind: 'daily', atMinute: (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0) };
}

export function routineDraftError(d: RoutineDraft): string | null {
  if (!d.name.trim()) return 'dê um nome à rotina';
  if (!d.prompt.trim()) return 'escreva o que o bot deve fazer';
  if (d.kind === 'interval' && !(Number.isInteger(d.everyMinutes) && d.everyMinutes >= MIN_BOT_ROUTINE_MINUTES)) {
    return `o intervalo mínimo é ${MIN_BOT_ROUTINE_MINUTES} min`;
  }
  return null;
}

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `r${Date.now().toString(36)}`; }
}

// Model, mode and effort stay off the routine: the server takes them from the bot.
export function buildRoutine(botId: string, d: RoutineDraft, now: number, id = newId()): Cron {
  return { id, name: d.name.trim(), prompt: d.prompt.trim(), schedule: routineSchedule(d), enabled: true, createdAt: now, botId };
}

export interface BotRoutinesInput {
  botId: string;
  crons: Cron[];
  connected: boolean;
  onCronsGet: () => void;
  onCronSave: (cron: Cron) => void;
  onCronDelete: (id: string) => void;
  onCronRun: (id: string) => void;
}

export function useBotRoutines({ botId, crons, connected, onCronsGet, onCronSave, onCronDelete, onCronRun }: BotRoutinesInput) {
  useEffect(() => { if (connected) onCronsGet(); }, [connected, onCronsGet]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), NOW_TICK_MS); return () => clearInterval(t); }, []);
  const [draft, setDraft] = useState<RoutineDraft | null>(null);

  const error = draft ? routineDraftError(draft) : null;
  const set = <K extends keyof RoutineDraft>(k: K, v: RoutineDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const submit = () => {
    if (!draft || error) return;
    onCronSave(buildRoutine(botId, draft, Date.now()));
    setDraft(null);
  };

  return {
    routines: routinesOf(crons, botId),
    now,
    draft,
    error,
    set,
    open: () => setDraft(emptyRoutineDraft()),
    cancel: () => setDraft(null),
    submit,
    toggle: (c: Cron) => onCronSave({ ...c, enabled: !c.enabled }),
    run: onCronRun,
    remove: onCronDelete,
  };
}

export type BotRoutines = ReturnType<typeof useBotRoutines>;
