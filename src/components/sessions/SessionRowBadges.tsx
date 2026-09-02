import { Badge } from '../primitives';
import { SessionRowTags } from './SessionRowTags';
import type { CtxWarn } from './row-meta';
import { fmtCost } from '../../../shared/format';

interface SessionRowBadgesProps {
  id: string;
  cost?: number;
  warn: CtxWarn | null;
  hasTerminal: boolean;
  idle: boolean;
  tags: string[];
  tagging: boolean;
  tagDraft: string;
  setTagDraft: (v: string) => void;
  setTagging: (v: boolean) => void;
  commitTag: () => void;
  onRemoveTag?: (id: string, tag: string) => void;
  onFilterTag?: (tag: string) => void;
}

// Custo só a partir de US$ 1: centavos não mudam decisão nenhuma e roubam a linha
// do que importa. No celular ele nem aparece — ali o espaço vale mais pro "quando".
const COST_FLOOR = 1;

export function SessionRowBadges({ id, cost, warn, hasTerminal, idle, tags, tagging, tagDraft, setTagDraft, setTagging, commitTag, onRemoveTag, onFilterTag }: SessionRowBadgesProps) {
  const showCost = cost !== undefined && cost >= COST_FLOOR;
  const hasOthers = !!warn || hasTerminal || idle || tags.length > 0 || tagging;
  if (!showCost && !hasOthers) return null;

  return (
    // Só custo (escondido no mobile) não pode deixar uma faixa vazia ocupando altura.
    <div className={`mt-2 flex flex-wrap items-center gap-1 ${hasOthers ? '' : 'max-lg:hidden'}`}>
      {showCost && (
        <span className="hidden text-[10px] tabular-nums text-neutral-500 lg:inline" title="Custo estimado acumulado desta sessão">{fmtCost(cost)}</span>
      )}
      {warn && <Badge tone={warn.tone}>contexto {warn.pct}%</Badge>}
      {hasTerminal && <Badge tone="green" dot>terminal</Badge>}
      {idle && <Badge tone="neutral">ociosa</Badge>}
      {(tags.length > 0 || tagging) && (
        <SessionRowTags
          id={id} tags={tags} tagging={tagging} tagDraft={tagDraft}
          setTagDraft={setTagDraft} setTagging={setTagging} commitTag={commitTag}
          onRemoveTag={onRemoveTag} onFilterTag={onFilterTag}
        />
      )}
    </div>
  );
}
