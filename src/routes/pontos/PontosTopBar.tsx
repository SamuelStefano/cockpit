import { Badge, Button, Icon } from '../../components/primitives';

interface Props {
  month?: string;
  state?: { tone: 'green' | 'yellow' | 'red'; text: string };
  syncLabel: string;
  stale: boolean;
  syncing: boolean;
  onSync: () => void;
  onNewEpic: () => void;
}

// Page title row: the route and month, the month-cap state, DFL sync freshness
// and the one top-level action.
export function PontosTopBar({ month, state, syncLabel, stale, syncing, onSync, onNewEpic }: Props) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800/80 px-4">
      <Icon name="star" size={15} className="shrink-0 text-orange-400" />
      <h1 className="text-[15px] font-semibold tracking-tight text-neutral-50">Pontos</h1>
      {month && <span className="font-mono text-[12px] text-neutral-500">{month}</span>}
      {state && <Badge tone={state.tone} dot>{state.text}</Badge>}
      <span className="hidden font-mono text-[11px] lowercase text-neutral-600 xl:inline">· rascunho no deck → épico no dfl → fatura dentro do teto</span>
      <span className="ml-auto flex items-center gap-1">
        <span className={`hidden text-[11px] md:inline ${stale ? 'text-yellow-300' : 'text-neutral-500'}`}>{stale ? 'dados velhos — sincronize' : syncLabel}</span>
        <Button variant={stale ? 'secondary' : 'ghost'} size="sm" square icon="rotate" loading={syncing} onClick={onSync}
          className={stale ? 'text-yellow-300' : ''} title={`Sincronizar com o DFL (${stale ? 'dados velhos' : syncLabel})`} aria-label="Sincronizar com o DFL" />
        <Button size="sm" icon="sparkles" onClick={onNewEpic}>
          <span className="hidden sm:inline">Novo épico com agente</span><span className="sm:hidden">Novo épico</span>
        </Button>
      </span>
    </div>
  );
}
