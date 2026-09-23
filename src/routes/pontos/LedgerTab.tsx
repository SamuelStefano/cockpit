import { useState } from 'react';
import type { PointsEntry } from '../../../shared/protocol';
import { Button, EmptyState, Skeleton } from '../../components/primitives';
import { PointsForm } from './PointsForm';
import { PointsCard } from './PointsCard';
import { fmtPts } from './money';

interface Props {
  connected: boolean;
  loaded: boolean;
  points: PointsEntry[];
  total: number;
  now: number;
  glowing: Set<string>;
  add: (title: string, points: number, description?: string) => void;
  correct: (entryId: string, points: number) => void;
  note: (entryId: string, description: string) => void;
  remove: (entryId: string) => void;
}

// The agent's own record: one entry per finished task (deck-points), real value,
// independent of what already exists in DFL.
export function LedgerTab({ connected, loaded, points, total, now, glowing, add, correct, note, remove }: Props) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-50">
            Ledger do agente <span className="font-mono text-[11px] font-normal tabular-nums text-neutral-500">{points.length} linhas · {fmtPts(total)} pt</span>
          </h2>
          <p className="text-[12px] leading-snug text-neutral-500">Cada task que o agente fecha vira uma linha aqui, com o valor real.</p>
        </div>
        <Button variant="secondary" size="sm" icon="plus" onClick={() => setAdding((v) => !v)}>adicionar manual</Button>
      </div>
      {adding && <PointsForm onAdd={add} onCancel={() => setAdding(false)} />}
      {!loaded && connected
        ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] w-full rounded-xl" />)}</div>
        : points.length === 0
        ? <EmptyState icon="star" title="Nenhum ponto ainda"
            description="Quando o agente terminar uma task com pontuação, ela aparece aqui sozinha. Você também pode adicionar manualmente." />
        : <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {points.map((e) => (
              <PointsCard key={e.entryId} entry={e} now={now} glow={glowing.has(e.entryId)}
                onCorrect={correct} onNote={note} onDelete={remove} />
            ))}
          </div>}
    </div>
  );
}
