import type { Cron } from '../../../shared/protocol';
import { nextRunAt } from '../../../shared/cron-schedule';
import { Button, Icon } from '../../components/primitives';
import { EffortPicker } from '../../components/chat/EffortPicker';
import type { useCronForm } from './useCronForm';

const field = 'rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-neutral-200 outline-none focus:border-orange-500/40';

function fmtClock(ts: number): string {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameDay ? `hoje ${t}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${t}`;
}

// Formulário de criação/edição de cron. A prévia de "próxima execução" materializa o
// draft num Cron tentativo e roda a mesma matemática do scheduler (shared).
export function CronForm({ form, onCancel, now }: {
  form: ReturnType<typeof useCronForm>;
  onCancel: () => void;
  now: number;
}) {
  const { draft, set, editing, valid, submit } = form;
  const preview: Cron = {
    id: 'preview', name: draft.name, prompt: draft.prompt,
    schedule: draft.kind === 'interval'
      ? { kind: 'interval', everyMinutes: Math.max(1, draft.everyMinutes) }
      : { kind: 'daily', atMinute: (() => { const [h, m] = draft.time.split(':').map((x) => parseInt(x, 10)); return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0); })() },
    enabled: true, createdAt: now,
  };

  return (
    <div className="mb-5 space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      {editing && (
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-orange-300">
          <Icon name="pencil" size={12} /> Editando “{draft.name || 'cron'}”
        </div>
      )}
      <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome (ex: resumo diário)"
        className={`w-full ${field} px-3 py-2 text-sm placeholder-neutral-600`} />
      <textarea value={draft.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder="Prompt a enviar…" rows={2}
        className={`scroll-thin w-full resize-none ${field} px-3 py-2 font-mono text-[13px] placeholder-neutral-600`} />
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <select value={draft.kind} onChange={(e) => set('kind', e.target.value as 'interval' | 'daily')} className={field}>
          <option value="daily">Diário</option>
          <option value="interval">Intervalo</option>
        </select>
        {draft.kind === 'daily'
          ? <input type="time" value={draft.time} onChange={(e) => set('time', e.target.value)} className={field} />
          : <span className="flex items-center gap-1 text-neutral-400">a cada <input type="number" min={1} value={draft.everyMinutes} onChange={(e) => set('everyMinutes', parseInt(e.target.value, 10) || 60)} className={`w-16 ${field}`} /> min</span>}
        <select value={draft.mode} onChange={(e) => set('mode', e.target.value as typeof draft.mode)} className={field}>
          <option value="plan">Planejar</option>
          <option value="acceptEdits">Executar</option>
        </select>
        <select value={draft.model} onChange={(e) => set('model', e.target.value)} className={field}>
          <option value="">modelo padrão</option>
          <option value="sonnet">Sonnet</option>
          <option value="opus">Opus</option>
          <option value="haiku">Haiku</option>
        </select>
        <EffortPicker effort={draft.effort} setEffort={(e) => set('effort', e)} disabled={false} />
      </div>
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="flex items-center gap-1.5 text-[11.5px] text-neutral-500">
          <Icon name="clock" size={12} /> próxima: <span className="tabular-nums text-neutral-400">{valid ? fmtClock(nextRunAt(preview, now)) : '—'}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {editing && <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>}
          <Button variant="primary" size="sm" onClick={() => submit()} disabled={!valid}>
            <Icon name={editing ? 'check' : 'plus'} size={14} /> {editing ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
