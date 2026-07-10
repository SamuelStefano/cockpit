import { useState, useRef, useEffect } from 'react';
import type { PointsEntry } from '../../../shared/protocol';
import { Button, Icon, Badge } from '../../components/primitives';
import { PointsHistory } from './PointsHistory';
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
  const [editPts, setEditPts] = useState(false);
  const [ptsDraft, setPtsDraft] = useState(String(entry.points));
  const [editDesc, setEditDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(entry.description ?? '');
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const savePts = () => {
    const n = Number(ptsDraft);
    setEditPts(false);
    if (Number.isFinite(n) && n >= 0 && n <= 100_000 && n !== entry.points) onCorrect(entry.entryId, n);
    else setPtsDraft(String(entry.points));
  };
  const saveDesc = () => {
    setEditDesc(false);
    const v = descDraft.trim();
    if (v !== (entry.description ?? '')) onNote(entry.entryId, v);
  };
  const clickDelete = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirmDelete) { setConfirmDelete(false); onDelete(entry.entryId); return; }
    setConfirmDelete(true);
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
  };

  return (
    <div className={`fade-up rounded-xl border bg-neutral-900/50 p-3 transition ${glow ? 'border-orange-500/40 glow-active' : 'border-neutral-800 hairline hover:border-neutral-700'}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-neutral-100">{entry.title || 'Sem título'}</span>
            <Badge tone={entry.by === 'agent' ? 'orange' : 'neutral'}>
              <Icon name={entry.by === 'agent' ? 'sparkles' : 'pencil'} size={9} /> {entry.by === 'agent' ? 'agente' : 'você'}
            </Badge>
            {entry.corrected && <Badge tone="yellow">corrigido {entry.originalPoints}→{entry.points}</Badge>}
            <span className="text-[11px] tabular-nums text-neutral-600">{relTime(entry.updatedAt, now)}</span>
          </div>

          {editDesc ? (
            <input
              autoFocus value={descDraft} onChange={(e) => setDescDraft(e.target.value)} onBlur={saveDesc}
              onKeyDown={(e) => { if (e.key === 'Enter') saveDesc(); if (e.key === 'Escape') { setDescDraft(entry.description ?? ''); setEditDesc(false); } }}
              placeholder="Descrição…"
              className="mt-1.5 w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-[12px] text-neutral-200 outline-none focus:border-orange-500/40"
            />
          ) : (
            <button onClick={() => { setDescDraft(entry.description ?? ''); setEditDesc(true); }}
              className="mt-1 block max-w-full truncate text-left text-[12px] text-neutral-400 hover:text-neutral-300">
              {entry.description || <span className="text-neutral-600">+ descrição</span>}
            </button>
          )}

          <button onClick={() => setShowHistory((v) => !v)}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300">
            <Icon name={showHistory ? 'chevronDown' : 'chevronRight'} size={11} />
            histórico ({entry.history.length})
          </button>
          {showHistory && <PointsHistory history={entry.history} />}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {editPts ? (
            <input
              autoFocus value={ptsDraft} onChange={(e) => setPtsDraft(e.target.value)} onBlur={savePts}
              onKeyDown={(e) => { if (e.key === 'Enter') savePts(); if (e.key === 'Escape') { setPtsDraft(String(entry.points)); setEditPts(false); } }}
              inputMode="numeric"
              className="w-16 rounded-md border border-orange-500/40 bg-neutral-950 px-1.5 py-0.5 text-right text-2xl font-semibold tabular-nums tracking-tight text-neutral-100 outline-none"
            />
          ) : (
            <button onClick={() => { setPtsDraft(String(entry.points)); setEditPts(true); }} title="Corrigir pontos"
              className="rounded-md px-1 text-2xl font-semibold tabular-nums tracking-tight text-neutral-100 transition hover:text-orange-300">
              {entry.points}
            </button>
          )}
          {confirmDelete
            ? <Button variant="danger" size="sm" className="text-red-400" title="Confirmar exclusão" onClick={clickDelete}>confirmar?</Button>
            : <Button variant="ghost" size="sm" icon="trash" title="Excluir" onClick={clickDelete} />}
        </div>
      </div>
    </div>
  );
}
