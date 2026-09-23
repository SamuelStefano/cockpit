import { Badge, Button, Icon } from '../../components/primitives';

interface Props {
  state?: { tone: 'green' | 'yellow' | 'red'; text: string };
  onNewEpic: () => void;
}

// Page title row: the route, the month-cap state and the one top-level action.
export function PontosTopBar({ state, onNewEpic }: Props) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-neutral-800/80 px-4">
      <Icon name="star" size={15} className="text-orange-400" />
      <h1 className="text-[15px] font-semibold tracking-tight text-neutral-50">Pontos</h1>
      <span className="hidden font-mono text-[11px] lowercase text-neutral-600 md:inline">rascunho no deck → épico no dfl → fatura dentro do teto</span>
      {state && <Badge tone={state.tone} dot>{state.text}</Badge>}
      <Button size="sm" icon="sparkles" className="ml-auto" onClick={onNewEpic}>
        <span className="hidden sm:inline">Novo épico com agente</span><span className="sm:hidden">Novo épico</span>
      </Button>
    </div>
  );
}
