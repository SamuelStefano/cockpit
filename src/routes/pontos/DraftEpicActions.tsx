import { Button, ButtonGroup } from '../../components/primitives';
import type { useDraftEpic } from './useDraftEpic';

interface Props {
  e: ReturnType<typeof useDraftEpic>;
  onAddDelivery: () => void;
}

// Header actions of a draft epic. The agent group is the main decision (send the
// whole epic, or what is left of it); structure edits and delete sit beside it.
export function DraftEpicActions({ e, onAddDelivery }: Props) {
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
        <Button variant="ghost" size="sm" icon="rotate" onClick={e.resetStatus} title="Marcar tudo como rascunho de novo">voltar a rascunho</Button>
      )}
      {e.armed
        ? <Button variant="dangerSolid" size="sm" onClick={e.clickDelete}>apagar épico?</Button>
        : <Button variant="ghost" size="sm" square icon="trash" title="Apagar rascunho" aria-label="Apagar rascunho" onClick={e.clickDelete} />}
    </>
  );
}
