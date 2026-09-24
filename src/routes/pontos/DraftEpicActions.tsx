import { Button, ButtonGroup } from '../../components/primitives';
import type { useDraftEpic } from './useDraftEpic';
import { useArmed } from '../../components/primitives/useArmed';

interface Props {
  e: ReturnType<typeof useDraftEpic>;
  onAddDelivery: () => void;
}

// Header actions of a draft epic. The agent group is the main decision (send the
// whole epic, or what is left of it); structure edits and delete sit beside it.
export function DraftEpicActions({ e, onAddDelivery }: Props) {
  // Back to draft makes the next "criar" send every task to DFL again: a mis-tap
  // here is a duplicate epic in prod, so it takes two taps.
  const reset = useArmed();
  const partial = e.progress === 'partial';
  return (
    <>
      <ButtonGroup label="agente">
        <Button size="sm" icon="zap" onClick={e.createAll} disabled={e.pending === 0}
          title="Um agente cria épico, deliveries e tasks no DFL">
          {partial
            ? `criar o restante no DFL (${e.pending})`
            : <><span className="hidden sm:inline">criar épico + deliveries + tasks</span><span className="sm:hidden">criar tudo no DFL</span></>}
        </Button>
      </ButtonGroup>
      <Button variant="ghost" size="sm" icon="plus" onClick={onAddDelivery}>delivery</Button>
      {e.progress !== 'draft' && (
        <Button variant={reset.armed ? 'danger' : 'ghost'} size="sm" icon="rotate" onClick={() => reset.fire(e.resetStatus)}
          title="Marca tudo como rascunho de novo: o próximo “criar” manda as tasks ao DFL outra vez">
          {reset.armed ? 'voltar tudo? recria no DFL' : 'voltar a rascunho'}
        </Button>
      )}
      {e.armed
        ? <Button variant="dangerSolid" size="sm" onClick={e.clickDelete}>apagar épico?</Button>
        : <Button variant="ghost" size="sm" square icon="trash" title="Apagar rascunho" aria-label="Apagar rascunho" onClick={e.clickDelete} />}
    </>
  );
}
