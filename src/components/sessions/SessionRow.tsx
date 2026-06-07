import { Icon, Badge } from '../primitives';
import type { Session } from '../../data/mock';
import { Highlight } from './Highlight';
import { SessionRowTags } from './SessionRowTags';
import { SessionRowActions } from './SessionRowActions';
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
  onDescribe?: (id: string, summary: string) => void;
  onClose: (id: string) => void;
  onDelete?: (id: string) => void;
  onStop?: (id: string) => void;
}

export function SessionRow({ s, active, highlight, ctx, cost, running, stalled, updated, pinned, tags = [], onTogglePin, onAddTag, onRemoveTag, onFilterTag, onSelect, onRename, onDescribe, onClose, onDelete, onStop }: SessionRowProps) {
  const { editing, setEditing, draft, setDraft, descEditing, setDescEditing, descDraft, setDescDraft, tagging, setTagging, tagDraft, setTagDraft, inputRef, descRef, tagRef, commit, commitDesc, commitTag } = useSessionRow({ s, onAddTag, onRename, onDescribe });

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
          <span
            className={`flex min-w-0 items-center gap-1.5 truncate text-left text-[12.5px] font-medium leading-tight ${active ? 'text-neutral-100' : 'text-neutral-300'}`}
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
          </span>
        )}
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {cost !== undefined && cost > 0 && (
              <span className="text-[9.5px] tabular-nums text-emerald-500/70" title="Custo estimado acumulado desta sessão">
                ${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}
              </span>
            )}
            <span className="hidden text-[10px] tabular-nums text-neutral-600 sm:inline">{s.relative}</span>
            {pinned && (
              <span title="Sessão fixada" className="text-orange-400">
                <Icon name="star" size={11} />
              </span>
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
            <SessionRowActions
              pinned={!!pinned}
              running={!!running}
              canStop={!!onStop}
              canDescribe={!!onDescribe}
              onTogglePin={onTogglePin ? () => onTogglePin(s.id) : undefined}
              onRename={() => { setDraft(s.title); setEditing(true); }}
              onDescribe={() => { setDescDraft(s.summary || ''); setDescEditing(true); }}
              onStop={onStop ? () => onStop(s.id) : undefined}
              onArchive={() => onClose(s.id)}
              onDelete={() => (onDelete ?? onClose)(s.id)}
            />
          </div>
        )}
      </div>
      {!editing && (descEditing ? (
        <textarea
          ref={descRef}
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={commitDesc}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commitDesc();
            if (e.key === 'Escape') { setDescDraft(s.summary || ''); setDescEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          rows={2}
          placeholder="Descrição da sessão…"
          className="mt-0.5 w-full resize-none rounded border border-orange-500/50 bg-neutral-950 px-1.5 py-1 text-[11.5px] leading-snug text-neutral-200 outline-none ring-2 ring-orange-500/20"
        />
      ) : (
        <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-500"><Highlight text={s.summary || s.snippet} term={highlight} /></p>
      ))}
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
