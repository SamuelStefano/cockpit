import type { Cron } from '../../../shared/protocol';
import { scheduleLabel, nextRunAt } from '../../../shared/cron-schedule';
import { Button, Icon, Badge } from '../../components/primitives';

function fmtLast(ts?: number): string {
  if (!ts) return 'nunca rodou';
  const d = new Date(ts);
  return `último: ${d.toLocaleDateString('pt-BR')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "em 2h 5min" / "em 40s" / "agora". now passado de fora pra ser determinístico.
function fmtIn(target: number, now: number): string {
  const ms = target - now;
  if (ms <= 0) return 'agora';
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'em <1min';
  if (min < 60) return `em ${min}min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  if (h < 24) return rem ? `em ${h}h ${rem}min` : `em ${h}h`;
  return `em ${Math.round(h / 24)}d`;
}

export function CronCard({ cron, now, editing, onRun, onToggle, onEdit, onDelete }: {
  cron: Cron;
  now: number;
  editing: boolean;
  onRun: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border bg-neutral-900/50 p-3 transition ${editing ? 'border-orange-500/40' : 'border-neutral-800 hover:border-neutral-700'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-neutral-100">{cron.name}</span>
          <Badge tone={cron.enabled ? 'green' : 'neutral'} dot>{cron.enabled ? 'ativo' : 'pausado'}</Badge>
          <span className="flex items-center gap-1 text-[11px] text-neutral-500"><Icon name="clock" size={10} />{scheduleLabel(cron.schedule)}</span>
          {cron.enabled && (
            <span className="text-[11px] font-medium tabular-nums text-orange-300/80">{fmtIn(nextRunAt(cron, now), now)}</span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] text-neutral-400">{cron.prompt}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-600">
          <span>{fmtLast(cron.lastRun)}</span>
          {cron.model && <span>· {cron.model}</span>}
          {cron.mode === 'acceptEdits' && <span>· executa</span>}
          {cron.effort && cron.effort !== 'low' && <span>· pensar: {cron.effort}</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" icon="play" title="Rodar agora" onClick={onRun} />
        <Button variant="ghost" size="sm" icon="pencil" title="Editar" onClick={onEdit} />
        <Button variant="ghost" size="sm" icon={cron.enabled ? 'square' : 'play'} title={cron.enabled ? 'Pausar' : 'Ativar'} onClick={onToggle} />
        <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={onDelete} />
      </div>
    </div>
  );
}
