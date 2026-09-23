import { Button, Icon } from '../../components/primitives';
import { brl } from './money';

interface Props {
  overCents: number;
  capCents: number;
  canSplit: boolean;
  onSplit: () => void;
}

// Rule 1 made actionable: an epic over R$ 5k is split, never trimmed. The
// button moves the tail that does not fit into a new epic, points intact.
export function OverCapNotice({ overCents, capCents, canSplit, onSplit }: Props) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-yellow-500/25 bg-yellow-500/[0.06] px-2.5 py-1.5 text-[12px] text-yellow-200">
      <Icon name="shield" size={13} className="shrink-0 text-yellow-400" />
      <span className="min-w-0 flex-1 tabular-nums">
        Passa {brl(overCents)} do teto de {brl(capCents)} por épico. Divida antes de criar — os pontos não mudam.
      </span>
      {canSplit
        ? <Button variant="outline" size="xs" icon="split" onClick={onSplit} title="Move as últimas tasks que não cabem pra um épico novo">dividir épico</Button>
        : <span className="text-[11px] text-yellow-300/70">Selecione tasks e use “novo épico com estas”.</span>}
    </div>
  );
}
