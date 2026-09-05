import { Badge, Icon, tokens } from '../primitives';
import { SessionRowTags } from './SessionRowTags';
import type { CtxWarn } from './row-meta';
import { fmtCost } from '../../../shared/format';

interface SessionRowBadgesProps {
  id: string;
  relative: string;
  // Data/hora absoluta, só quando o relativo não desempata (título ambíguo).
  stamp?: string;
  pinned: boolean;
  marathon: boolean;
  canTag: boolean;
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

// Faixa de rodapé do card. Ela existe SEMPRE (o "quando" mora aqui) porque numa
// sidebar de ~200px o relógio e os botões na linha do título comiam metade da
// largura e deixavam todo título em "Handoff retomado…" / "Retoma do contexto…" —
// duas sessões diferentes que ficavam idênticas na tela. Rodapé = título inteiro.
export function SessionRowBadges({ id, relative, stamp, pinned, marathon, canTag, cost, warn, hasTerminal, idle, tags, tagging, tagDraft, setTagDraft, setTagging, commitTag, onRemoveTag, onFilterTag }: SessionRowBadgesProps) {
  const showCost = cost !== undefined && cost >= COST_FLOOR;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {canTag && (
          <button
            onClick={(e) => { e.stopPropagation(); setTagging(!tagging); }}
            title="Adicionar etiqueta"
            className={`block rounded-sm p-1.5 text-neutral-600 transition hover:bg-neutral-800 hover:text-sky-300 sm:p-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 ${tokens.touchBox}`}
          >
            <Icon name="tag" size={12} />
          </button>
        )}
        {showCost && (
          <span className="hidden text-[10px] tabular-nums text-neutral-500 lg:inline" title="Custo estimado acumulado desta sessão">{fmtCost(cost)}</span>
        )}
        {pinned && (
          <span title="Sessão fixada" className="text-orange-400">
            <Icon name="star" size={11} />
          </span>
        )}
        {marathon && (
          <span title="Modo maratona: sem teto de 8h, retoma sozinha" className="text-sky-400">
            <Icon name="zap" size={11} />
          </span>
        )}
        <span className="text-[10.5px] tabular-nums text-neutral-600" title={stamp ? `Última atividade: ${stamp}` : 'Última atividade'}>{stamp ?? relative}</span>
      </span>
    </div>
  );
}
