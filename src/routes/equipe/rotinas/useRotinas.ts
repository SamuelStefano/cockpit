import { useEffect, useState } from 'react';
import type { Cron, TeamBot } from '../../../../shared/protocol';
import type { CronSchedule } from '../../../../shared/protocol';
import type { CronApi } from '../equipe-props';
import { canToggleOn, historyOf, nameFromPrompt } from './routine-view';

const NOW_TICK_MS = 30_000;

export interface RoutineInput { botId: string; prompt: string; schedule: CronSchedule; retry: boolean }

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `r${Date.now().toString(36)}`; }
}

export function buildRoutine(input: RoutineInput, existing: Cron | undefined, now: number, id = newId()): Cron {
  const base: Cron = existing
    ? { ...existing, prompt: input.prompt.trim(), schedule: input.schedule, botId: input.botId }
    : { id, name: nameFromPrompt(input.prompt), prompt: input.prompt.trim(), schedule: input.schedule, enabled: true, createdAt: now, botId: input.botId };
  if (input.retry) base.retry = true; else delete base.retry;
  return base;
}

export interface RotinasInput extends CronApi {
  bots: TeamBot[];
  connected: boolean;
  botId?: string;
}

export type ModalState = { editing?: Cron } | null;

export function useRotinas({ crons, bots, connected, botId, onCronsGet, onCronSave, onCronDelete, onCronRun }: RotinasInput) {
  useEffect(() => { if (connected) onCronsGet(); }, [connected, onCronsGet]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), NOW_TICK_MS); return () => clearInterval(t); }, []);
  const [modal, setModal] = useState<ModalState>(null);

  const routines = botId ? crons.filter((c) => c.botId === botId) : crons;
  return {
    bots,
    routines,
    history: historyOf(routines, now),
    now,
    modal,
    openNew: () => setModal({}),
    openEdit: (c: Cron) => setModal({ editing: c }),
    close: () => setModal(null),
    save: (input: RoutineInput) => {
      onCronSave(buildRoutine(input, modal?.editing, Date.now()));
      setModal(null);
    },
    toggle: (c: Cron) => { if (canToggleOn(c, Date.now())) onCronSave({ ...c, enabled: !c.enabled }); else setModal({ editing: c }); },
    run: onCronRun,
    remove: onCronDelete,
  };
}

export type Rotinas = ReturnType<typeof useRotinas>;
