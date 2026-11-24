import { useMemo, useState } from 'react';
import type { Cron, TeamBot } from '../../../../shared/protocol';
import { parseScheduleText, nextRuns, scheduleToText } from '../../../../shared/schedule-pt';
import { Button, Icon, Modal, tokens } from '../../../components/primitives';
import { Mascot } from '../../../components/team/Mascot';
import { dayLabel, hhmm, runLabel } from './routine-view';
import type { RoutineInput } from './useRotinas';

interface NewRoutineProps {
  bots: TeamBot[];
  now: number;
  editing?: Cron;
  fixedBotId?: string;
  onClose: () => void;
  onSubmit: (input: RoutineInput) => void;
}

const field = 'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[14px] text-neutral-100 placeholder-neutral-600 outline-hidden focus:border-orange-500/40';

export function NewRoutine({ bots, now, editing, fixedBotId, onClose, onSubmit }: NewRoutineProps) {
  const initialBot = editing?.botId ?? fixedBotId ?? bots.find((b) => b.primary)?.id ?? bots[0]?.id ?? '';
  const [botId, setBotId] = useState(initialBot);
  const [prompt, setPrompt] = useState(editing?.prompt ?? '');
  const [when, setWhen] = useState(editing ? scheduleToText(editing.schedule) : '');
  const [retry, setRetry] = useState(editing?.retry ?? false);
  const parsed = useMemo(() => (when.trim() ? parseScheduleText(when, now) : null), [when, now]);
  const runs = parsed?.ok ? nextRuns(parsed.schedule, now, 3) : [];
  const first = runs[0];
  const canSubmit = !!botId && !!prompt.trim() && !!parsed?.ok;
  const submit = () => { if (parsed?.ok && canSubmit) onSubmit({ botId, prompt, schedule: parsed.schedule, retry }); };
  const label = 'mb-1.5 block text-[13px] text-neutral-400';
  return (
    <Modal
      open onClose={onClose} label={editing ? 'Editar rotina' : 'Nova rotina'} maxWidth="max-w-135"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon="check" onClick={submit} disabled={!canSubmit}>{editing ? 'Salvar rotina' : 'Criar rotina'}</Button>
        </>
      }
    >
      <h2 className="mb-4 text-[17px] font-semibold text-neutral-100">{editing ? 'Editar rotina' : 'Nova rotina'}</h2>
      <div className="flex flex-col gap-4">
        {!fixedBotId && (
          <div>
            <span id="rt-who" className={label}>Quem faz</span>
            <div role="radiogroup" aria-labelledby="rt-who" className="flex flex-wrap gap-1.5">
              {bots.map((b) => (
                <button
                  key={b.id} type="button" role="radio" aria-checked={botId === b.id} onClick={() => setBotId(b.id)}
                  className={`flex h-8 items-center gap-1.5 rounded-full border pl-1.5 pr-2.5 text-[13px] transition ${tokens.focusRing} ${botId === b.id ? 'border-neutral-500 bg-neutral-800 text-neutral-100' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
                >
                  <span aria-hidden="true" className="flex"><Mascot mascot={b.mascot} size={22} /></span>{b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label htmlFor="rt-what" className={label}>O que fazer</label>
          <textarea id="rt-what" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className={`scroll-thin resize-none ${field}`}
            placeholder="Ex: Revisar o calendário editorial da semana e sugerir 2 posts." />
        </div>
        <div>
          <label htmlFor="rt-when" className={label}>Quando</label>
          <input id="rt-when" value={when} onChange={(e) => setWhen(e.target.value)} className={field} placeholder="toda segunda às 8h" autoComplete="off" />
          <div className="mt-2 text-[13px] text-neutral-500" aria-live="polite">
            {parsed?.ok && first !== undefined && (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <Icon name="clock" size={13} className="shrink-0" />
                <span>Entendi: <b className="font-medium text-neutral-100">{parsed.summary}</b></span>
                <span>· próxima: {dayLabel(first, now)}{parsed.schedule.kind === 'daily' ? '' : ` ${hhmm(first)}`} · horário de Brasília</span>
              </span>
            )}
            {parsed?.ok && first === undefined && <span className="text-amber-300">Esse horário já passou.</span>}
            {parsed && !parsed.ok && <span className="text-amber-300">{parsed.error}</span>}
            {!parsed && <span>Escreva do seu jeito: "todo dia útil às 9h", "a cada 2 horas", "todo dia 1 às 8h".</span>}
          </div>
          {parsed?.ok && (
            <details className="mt-2 text-[12px] text-neutral-500">
              <summary className="cursor-pointer select-none text-neutral-400 hover:text-neutral-200">Detalhes</summary>
              <div className="mt-1.5 flex flex-col gap-1">
                {runs.length > 0 && <span>Próximas 3: {runs.map(runLabel).join(' · ')}</span>}
                <span>Cron: <code className="font-mono text-neutral-300">{parsed.cron ?? 'sem equivalente em cron simples'}</code></span>
              </div>
            </details>
          )}
        </div>
        <div>
          <span className={label}>Se falhar</span>
          <button
            type="button" role="switch" aria-checked={retry} onClick={() => setRetry((r) => !r)}
            className={`flex items-center gap-2.5 rounded-lg text-[13px] text-neutral-200 ${tokens.focusRing}`}
          >
            <span className={`relative h-4.5 w-8 shrink-0 rounded-full transition ${retry ? 'bg-orange-500' : 'bg-neutral-700'}`}>
              <span className={`absolute top-0.75 h-3 w-3 rounded-full bg-white transition-all ${retry ? 'left-4.5' : 'left-0.75'}`} />
            </span>
            Tentar de novo em 1 h, até 3 vezes
          </button>
        </div>
      </div>
    </Modal>
  );
}
