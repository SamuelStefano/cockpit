import { Icon, Badge } from '../primitives';
import type { Session } from '../../data/mock';
import { Highlight } from './Highlight';
import { SessionRowTags } from './SessionRowTags';
import { useSessionRow } from './useSessionRow';
import { ctxPercent, ctxTone, isIdle } from './row-meta';

export interface SessionRowProps {
  s: Session;
  active: boolean;
  highlight?: string;
  ctx?: number;
  cost?: number;
  running?: boolean;
  stalled?: boolean;
  updated?: boolean;
  pinned?: boolean;
  tags?: string[];
  onTogglePin?: (id: string) => void;
  onAddTag?: (id: string, tag: string) => void;
  onRemoveTag?: (id: string, tag: string) => void;
  onFilterTag?: (tag: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClose: (id: string) => void;
  onStop?: (id: string) => void;
}

export function SessionRow({ s, active, highlight, ctx, cost, running, stalled, updated, pinned, tags = [], onTogglePin, onAddTag, onRemoveTag, onFilterTag, onSelect, onRename, onClose, onStop }: SessionRowProps) {
  const { editing, setEditing, draft, setDraft, tagging, setTagging, tagDraft, setTagDraft, inputRef, tagRef, commit, commitTag } = useSessionRow({ s, onAddTag, onRename });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={() => onSelect(s.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return; // tecla foi pra um botão/input interno
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); }
      }}
      className={`group relative cursor-pointer rounded-lg border px-2.5 py-2 transition outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
        ${active
          ? 'border-orange-500/40 bg-orange-500/[0.07]'
          : 'border-transparent hover:border-neutral-800 hover:bg-neutral-900'}`}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full bg-orange-500" />}
      <div className="mb-1 flex items-center justify-between gap-2">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setDraft(s.title); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-orange-500/50 bg-neutral-950 px-1.5 py-0.5 text-[12.5px] font-medium text-neutral-100 outline-none ring-2 ring-orange-500/20"
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setDraft(s.title); setEditing(true); }}
            title="Clique para renomear"
            className={`flex min-w-0 items-center gap-1.5 truncate text-left text-[12.5px] font-medium leading-tight ${active ? 'text-neutral-100' : 'text-neutral-300'} hover:text-orange-300`}
          >
            {running && !stalled && (
              <span className="relative flex h-1.5 w-1.5 shrink-0" title="Sessão trabalhando agora">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
              </span>
            )}
            {running && stalled && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Trabalhando, mas sem output há alguns minutos (tool longo, rate-limit ou travada)" />
            )}
            {!running && updated && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" title="Novo output desde a última vez que você abriu" />
            )}
            <span className={`truncate ${!running && updated && !active ? 'text-neutral-100' : ''}`}><Highlight text={s.title} term={highlight} /></span>
          </button>
        )}
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {cost !== undefined && cost > 0 && (
              <span className="text-[9.5px] tabular-nums text-emerald-500/70" title="Custo estimado acumulado desta sessão">
                ${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}
              </span>
            )}
            <span className="hidden text-[10px] tabular-nums text-neutral-600 sm:inline sm:group-hover:hidden">{s.relative}</span>
            {running && onStop && (
              <button
                onClick={(e) => { e.stopPropagation(); onStop(s.id); }}
                title="Parar o turno desta sessão"
                className="block rounded p-0.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400 sm:hidden sm:group-hover:block"
              >
                <Icon name="square" size={12} />
              </button>
            )}
            {onAddTag && (
              <button
                onClick={(e) => { e.stopPropagation(); setTagging(!tagging); }}
                title="Adicionar etiqueta"
                className="block rounded p-0.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-sky-300 sm:hidden sm:group-hover:block"
              >
                <Icon name="tag" size={12} />
              </button>
            )}
            {onTogglePin && (
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin(s.id); }}
                title={pinned ? 'Desafixar sessão' : 'Fixar sessão no topo'}
                className={`rounded p-0.5 transition hover:bg-neutral-800
                  ${pinned ? 'text-orange-400 hover:text-orange-300' : 'block text-neutral-500 hover:text-orange-300 sm:hidden sm:group-hover:block'}`}
              >
                <Icon name="star" size={12} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
              title="Arquivar sessão (some do sidebar; o histórico não é apagado)"
              className="block rounded p-0.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-orange-300 sm:hidden sm:group-hover:block"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        )}
      </div>
      {!editing && (
        <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-500"><Highlight text={s.summary || s.snippet} term={highlight} /></p>
      )}
      {!editing && (() => {
        const pct = ctxPercent(ctx);
        if (pct === null) return null;
        return (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-neutral-800" title={`${Math.round((ctx ?? 0) / 1000)}k / 200k tokens de contexto`}>
              <div className={`h-full rounded-full ${ctxTone(pct)}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-[9px] tabular-nums text-neutral-500" title="% da janela de contexto (200k) em uso">{pct}%</span>
          </div>
        );
      })()}
      {!editing && isIdle(s.mtime, !!running) && (
        <div className="mt-1.5">
          <Badge tone="neutral">ociosa</Badge>
        </div>
      )}
      {s.hasTerminal && !editing && (
        <div className="mt-1.5">
          <Badge tone="green" dot>terminal ativo</Badge>
        </div>
      )}
      {!editing && (tags.length > 0 || tagging) && (
        <SessionRowTags
          id={s.id} tags={tags} tagging={tagging} tagDraft={tagDraft} tagRef={tagRef}
          setTagDraft={setTagDraft} setTagging={setTagging} commitTag={commitTag}
          onRemoveTag={onRemoveTag} onFilterTag={onFilterTag}
        />
      )}
    </div>
  );
}
