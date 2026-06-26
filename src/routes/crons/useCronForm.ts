import { useState } from 'react';
import type { Cron, CronSchedule, PermMode, Effort } from '../../../shared/protocol';

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `c${Date.now().toString(36)}`; }
}

export interface CronDraft {
  id?: string;
  name: string;
  prompt: string;
  kind: 'interval' | 'daily';
  everyMinutes: number;
  time: string;
  model: string;
  mode: PermMode;
  effort: Effort;
}

const EMPTY: CronDraft = { name: '', prompt: '', kind: 'daily', everyMinutes: 60, time: '09:00', model: '', mode: 'plan', effort: 'low' };

function toDraft(c: Cron): CronDraft {
  const at = c.schedule.atMinute ?? 540;
  return {
    id: c.id,
    name: c.name,
    prompt: c.prompt,
    kind: c.schedule.kind,
    everyMinutes: c.schedule.everyMinutes ?? 60,
    time: `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`,
    model: c.model ?? '',
    mode: c.mode ?? 'plan',
    effort: c.effort ?? 'low',
  };
}

// Estado do formulário de cron — serve tanto criar (id ausente) quanto editar (id do
// cron sendo alterado). `build()` materializa o Cron pronto pra salvar.
export function useCronForm(onSave: (c: Cron) => void) {
  const [draft, setDraft] = useState<CronDraft>(EMPTY);
  // Cron original sendo editado: preserva enabled/createdAt/lastRun no salvar (sem
  // isto, editar resetaria o histórico e reativaria um cron pausado).
  const [original, setOriginal] = useState<Cron | null>(null);
  const set = <K extends keyof CronDraft>(k: K, v: CronDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const editing = !!draft.id;
  const valid = draft.name.trim().length > 0 && draft.prompt.trim().length > 0;

  const reset = () => { setDraft(EMPTY); setOriginal(null); };
  const startEdit = (c: Cron) => { setDraft(toDraft(c)); setOriginal(c); };

  const submit = () => {
    if (!valid) return;
    const [h, m] = draft.time.split(':').map((x) => parseInt(x, 10));
    const schedule: CronSchedule = draft.kind === 'interval'
      ? { kind: 'interval', everyMinutes: Math.max(1, draft.everyMinutes) }
      : { kind: 'daily', atMinute: (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0) };
    onSave({
      id: draft.id ?? newId(),
      name: draft.name.trim(),
      prompt: draft.prompt.trim(),
      schedule,
      model: draft.model || undefined,
      mode: draft.mode,
      effort: draft.effort,
      enabled: original?.enabled ?? true,
      createdAt: original?.createdAt ?? Date.now(),
      lastRun: original?.lastRun,
    });
    reset();
  };

  return { draft, set, editing, valid, reset, startEdit, submit };
}
