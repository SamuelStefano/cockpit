import type { DflDraft } from '../../../shared/dfl-drafts';
import { Button, ButtonGroup } from '../../components/primitives';
import type { useDraftEpic } from './useDraftEpic';
import { useToggle } from './useToggle';
import { brlShort, fmtPts } from './money';

interface Props {
  draft: DflDraft;
  e: ReturnType<typeof useDraftEpic>;
}

// Floating bar while tasks are selected: move them to another delivery, carve a
// new epic out of them, or send only them to the agent.
export function TaskSelectionBar({ draft, e }: Props) {
  const moving = useToggle(false);
  const s = e.selection;
  return (
    <div className="sticky bottom-2 z-10 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-orange-500/30 bg-neutral-950/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur-sm">
      <span className="text-[12.5px] font-semibold text-neutral-100">{s.count} {s.count === 1 ? 'selecionada' : 'selecionadas'}</span>
      <span className="font-mono text-[11.5px] tabular-nums text-neutral-400">{fmtPts(s.points)} pt · {brlShort(s.valueCents)}</span>
      <span className="ml-auto flex flex-wrap items-center gap-1.5">
        {moving.on
          ? <>
              <span className="text-[11.5px] text-neutral-500">mover para</span>
              {draft.deliveries.map((dl) => (
                <Button key={dl.id} variant="outline" size="xs" onClick={() => { e.moveTo(dl.id); moving.set(false); }} className="max-w-48">{dl.title}</Button>
              ))}
              <Button variant="outline" size="xs" icon="plus" onClick={() => { e.moveToNew(); moving.set(false); }}>nova delivery</Button>
              <Button variant="ghost" size="xs" square icon="x" onClick={moving.toggle} title="Cancelar" aria-label="Cancelar mover" />
            </>
          : <>
              <Button variant="ghost" size="sm" icon="move" onClick={moving.toggle}>mover</Button>
              <Button variant="ghost" size="sm" icon="split" onClick={e.splitSelected} disabled={s.count >= draft.tasks.length}
                title="Tira as selecionadas deste épico e cria outro com elas">novo épico com estas</Button>
              <ButtonGroup label="agente">
                <Button size="sm" icon="zap" onClick={e.createSelected} disabled={s.pending === 0}>criar selecionadas</Button>
              </ButtonGroup>
              <Button variant="ghost" size="sm" onClick={e.clear}>limpar</Button>
            </>}
      </span>
    </div>
  );
}
