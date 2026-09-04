import { useState } from 'react';
import type { Cron, CronSchedule, PermMode, Effort } from '../../../shared/protocol';

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `c${Date.now().toString(36)}`; }
}

export interface CronDraft {
  id?: string;
  name: string;
  prompt: string;
  kind: CronSchedule['kind'];
  everyMinutes: number;
  time: string;
  at: string;
  model: string;
  mode: PermMode;
  effort: Effort;
}

// `datetime-local` fala hora local sem fuso; o offset entra na mão nos dois sentidos.
export function toLocalInput(ts: number): string {
  return new Date(ts - new Date(ts).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function buildSchedule(d: CronDraft): CronSchedule {
  if (d.kind === 'interval') return { kind: 'interval', everyMinutes: Math.max(1, d.everyMinutes) };
  if (d.kind === 'once') return { kind: 'once', atMs: new Date(d.at).getTime() };
  const [h, m] = d.time.split(':').map((x) => parseInt(x, 10));
  return { kind: 'daily', atMinute: (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0) };
}

export function draftValid(d: CronDraft): boolean {
  if (!d.name.trim() || !d.prompt.trim()) return false;
  return d.kind !== 'once' || Number.isFinite(new Date(d.at).getTime());
}

// Um "uma vez" vale pelo instante marcado: remarcar pra frente re-arma o que já
// disparou (o servidor pausa ao rodar) e data no passado nasce pausada em vez de
// disparar um turno autônomo nos próximos 30s por um ano digitado errado.
export function enabledFor(s: CronSchedule, original: Cron | null, now: number): boolean {
  if (s.kind === 'once') return (s.atMs ?? 0) > now;
  return original?.enabled ?? true;
}

const empty = (): CronDraft => ({
  name: '', prompt: '', kind: 'daily', everyMinutes: 60, time: '09:00',
  at: toLocalInput(Date.now() + 3_600_000), model: '', mode: 'plan', effort: 'low',
});

function toDraft(c: Cron): CronDraft {
  const at = c.schedule.atMinute ?? 540;
  return {
    ...empty(),
    id: c.id,
    name: c.name,
    prompt: c.prompt,
    kind: c.schedule.kind,
    everyMinutes: c.schedule.everyMinutes ?? 60,
    time: `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`,
    at: toLocalInput(c.schedule.atMs ?? Date.now() + 3_600_000),
    model: c.model ?? '',
    mode: c.mode ?? 'plan',
    effort: c.effort ?? 'low',
  };
}

// Estado do formulário de cron — serve tanto criar (id ausente) quanto editar (id do
// cron sendo alterado). `build()` materializa o Cron pronto pra salvar.
export function useCronForm(onSave: (c: Cron) => void) {
  const [draft, setDraft] = useState<CronDraft>(empty);
  // Cron original sendo editado: preserva enabled/createdAt/lastRun no salvar (sem
  // isto, editar resetaria o histórico e reativaria um cron pausado).
  const [original, setOriginal] = useState<Cron | null>(null);
  const set = <K extends keyof CronDraft>(k: K, v: CronDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const editing = !!draft.id;
  const valid = draftValid(draft);

  const reset = () => { setDraft(empty()); setOriginal(null); };
  const startEdit = (c: Cron) => { setDraft(toDraft(c)); setOriginal(c); };

  // Agenda pro instante em que a cota volta. Troca o `kind` junto: o preset só faz
  // sentido como one-shot, e deixar o usuário lembrar de mudar o seletor antes era
  // o passo em que o agendamento silenciosamente virava outra coisa.
  const applyResetPreset = (atMs: number) => setDraft((d) => ({ ...d, kind: 'once', at: toLocalInput(atMs) }));

  const submit = () => {
    if (!valid) return;
    const schedule = buildSchedule(draft);
    onSave({
      id: draft.id ?? newId(),
      name: draft.name.trim(),
      prompt: draft.prompt.trim(),
      schedule,
      model: draft.model || undefined,
      mode: draft.mode,
      effort: draft.effort,
      enabled: enabledFor(schedule, original, Date.now()),
      createdAt: original?.createdAt ?? Date.now(),
      lastRun: original?.lastRun,
    });
    reset();
  };

  return { draft, set, editing, valid, reset, startEdit, submit, applyResetPreset };
}
