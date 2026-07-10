import { useState } from 'react';
import type { PointsEntry } from '../../shared/protocol';
import { Button, Icon, EmptyState, Skeleton } from '../components/primitives';
import { usePontos } from './pontos/usePontos';
import { PointsForm } from './pontos/PointsForm';
import { PointsCard } from './pontos/PointsCard';

interface Props {
  connected: boolean;
  points: PointsEntry[];
  total: number;
  loaded: boolean;
  onPointsGet: () => void;
  onPointsAdd: (title: string, points: number, description?: string) => void;
  onPointsCorrect: (entryId: string, points: number) => void;
  onPointsNote: (entryId: string, description: string) => void;
  onPointsDelete: (entryId: string) => void;
}

// Ledger vivo de pontuação: a IA registra ao terminar uma task; você corrige sem
// sobrescrever — o histórico prevalece. Atualiza ao vivo em todos os aparelhos.
export function Pontos({ connected, points, total, loaded, onPointsGet, onPointsAdd, onPointsCorrect, onPointsNote, onPointsDelete }: Props) {
  const { now, glowing, add, correct, note, remove } = usePontos({ connected, points, onPointsGet, onPointsAdd, onPointsCorrect, onPointsNote, onPointsDelete });
  const [adding, setAdding] = useState(false);

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-neutral-100">Pontos</h1>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="hairline rounded-lg text-4xl font-semibold tabular-nums tracking-tight text-orange-400">{total}</span>
              <span className="text-[12.5px] text-neutral-500">pts em {points.length} {points.length === 1 ? 'registro' : 'registros'}</span>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setAdding((v) => !v)}>
            <Icon name="plus" size={14} /> adicionar manual
          </Button>
        </header>

        {adding && <PointsForm onAdd={add} onCancel={() => setAdding(false)} />}

        {!loaded && connected
          ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[84px] w-full rounded-xl" />)}</div>
          : points.length === 0
          ? <EmptyState icon="star" title="Nenhum ponto ainda"
              description="Quando eu terminar uma task com pontuação, ela aparece aqui sozinha. Você também pode adicionar manualmente." />
          : <div className="space-y-2">
              {points.map((e) => (
                <PointsCard key={e.entryId} entry={e} now={now} glow={glowing.has(e.entryId)}
                  onCorrect={correct} onNote={note} onDelete={remove} />
              ))}
            </div>}
      </div>
    </div>
  );
}
