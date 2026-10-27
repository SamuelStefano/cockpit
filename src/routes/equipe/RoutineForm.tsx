import { Button, Input, Segmented } from '../../components/primitives';
import { MIN_BOT_ROUTINE_MINUTES } from '../../../shared/bot-routine';
import type { RoutineDraft } from './useBotRoutines';

interface RoutineFormProps {
  draft: RoutineDraft;
  error: string | null;
  set: <K extends keyof RoutineDraft>(k: K, v: RoutineDraft[K]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const KINDS = [{ id: 'interval' as const, label: 'A cada' }, { id: 'daily' as const, label: 'Todo dia' }];
const field = 'rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[13px] text-neutral-200 outline-hidden focus:border-orange-500/40';

export function RoutineForm({ draft, error, set, onSubmit, onCancel }: RoutineFormProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
      <Input size="sm" value={draft.name} onChange={(e) => set('name', e.target.value)} aria-label="Nome da rotina" placeholder="Nome (ex: métricas do dia)" />
      <textarea value={draft.prompt} onChange={(e) => set('prompt', e.target.value)} aria-label="Prompt da rotina" rows={3}
        placeholder="O que o bot faz a cada disparo…" className={`scroll-thin w-full resize-none ${field} placeholder-neutral-600`} />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented items={KINDS} value={draft.kind} onChange={(k) => set('kind', k)} label="Agenda" />
        {draft.kind === 'interval'
          ? <span className="flex items-center gap-1 text-[13px] text-neutral-400">
              <input type="number" min={MIN_BOT_ROUTINE_MINUTES} aria-label="Intervalo em minutos" value={draft.everyMinutes || ''}
                onChange={(e) => set('everyMinutes', e.target.value === '' ? 0 : parseInt(e.target.value, 10))} className={`w-16 ${field}`} /> min
            </span>
          : <input type="time" aria-label="Horário" value={draft.time} onChange={(e) => set('time', e.target.value)} className={field} />}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-neutral-500">{error ?? 'Roda na conversa do bot (horário de Brasília).'}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" size="sm" icon="plus" onClick={onSubmit} disabled={!!error}>Criar</Button>
        </div>
      </div>
    </div>
  );
}
