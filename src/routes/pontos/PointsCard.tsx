import type { PointsEntry } from '../../../shared/protocol';
import { Button, Icon, Badge } from '../../components/primitives';
import { PointsHistory } from './PointsHistory';
import { usePointsCard } from './usePointsCard';
import { relTime } from './format';

interface Props {
  entry: PointsEntry;
  now: number;
  glow: boolean;
  onCorrect: (entryId: string, points: number) => void;
  onNote: (entryId: string, description: string) => void;
  onDelete: (entryId: string) => void;
}

export function PointsCard({ entry, now, glow, onCorrect, onNote, onDelete }: Props) {
  const c = usePointsCard({ entry, onCorrect, onNote, onDelete });

  return (
    <div className={`fade-up flex flex-col rounded-xl border bg-neutral-900/50 p-3.5 transition ${glow ? 'border-orange-500/40 glow-active' : 'border-neutral-800 hairline hover:border-neutral-700'}`}>
      <div className="flex items-start justify-between gap-2">
        {c.editPts ? (
          <input
            autoFocus value={c.ptsDraft} onChange={(e) => c.setPtsDraft(e.target.value)} onBlur={c.savePts}
            onKeyDown={(e) => { if (e.key === 'Enter') c.savePts(); if (e.key === 'Escape') c.cancelPts(); }}
            inputMode="numeric"
            className="w-20 rounded-md border border-orange-500/40 bg-neutral-950 px-1.5 py-0.5 text-3xl font-bold tabular-nums tracking-tight text-neutral-100 outline-none"
          />
        ) : (
          <button onClick={c.startEditPts} title="Corrigir pontos"
            className="flex items-baseline gap-1 rounded-md text-3xl font-bold tabular-nums tracking-tight text-neutral-100 transition hover:text-orange-300">
            {entry.points}
            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-600">pts</span>
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={entry.by === 'agent' ? 'orange' : 'neutral'}>
            <Icon name={entry.by === 'agent' ? 'sparkles' : 'pencil'} size={9} /> {entry.by === 'agent' ? 'agente' : 'você'}
          </Badge>
          {c.confirmDelete
            ? <Button variant="danger" size="sm" className="text-red-400" title="Confirmar exclusão" onClick={c.clickDelete}>confirmar?</Button>
            : <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={c.clickDelete} />}
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-neutral-100">{entry.title || 'Sem título'}</p>

      {c.editDesc ? (
        <input
          autoFocus value={c.descDraft} onChange={(e) => c.setDescDraft(e.target.value)} onBlur={c.saveDesc}
          onKeyDown={(e) => { if (e.key === 'Enter') c.saveDesc(); if (e.key === 'Escape') c.cancelDesc(); }}
          placeholder="Descrição…"
          className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-[12px] text-neutral-200 outline-none focus:border-orange-500/40"
        />
      ) : (
        <button onClick={c.startEditDesc}
          className="mt-1 line-clamp-2 max-w-full text-left text-[12px] leading-snug text-neutral-400 hover:text-neutral-300">
          {entry.description || <span className="text-neutral-600">+ descrição</span>}
        </button>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2.5">
        {entry.corrected && <Badge tone="yellow">corrigido {entry.originalPoints}→{entry.points}</Badge>}
        <button onClick={c.toggleHistory}
          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300">
          <Icon name={c.showHistory ? 'chevronDown' : 'chevronRight'} size={11} />
          histórico ({entry.history.length})
        </button>
        <span className="ml-auto text-[11px] tabular-nums text-neutral-600">{relTime(entry.updatedAt, now)}</span>
      </div>
      {c.showHistory && <PointsHistory history={entry.history} />}
    </div>
  );
}
