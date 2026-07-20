import { useEffect, useRef } from 'react';
import { Badge } from '../primitives';
import { usePersisted } from '../../lib/persist';
import { SHOW_SESSION_DESC_KEY, SHOW_SESSION_DESC_DEFAULT } from '../../lib/prefs';
import type { Session } from '../../data/mock';
import { Highlight } from './Highlight';
import { SessionRowTags } from './SessionRowTags';
import { SessionStatusDot } from './SessionStatusDot';
import { SessionRowMeta } from './SessionRowMeta';
import { RunStatus } from './RunStatus';
import { useSessionRow } from './useSessionRow';
import { useLongPress } from './useLongPress';
import { ctxWarn, isIdle } from './row-meta';

export interface SessionRowProps {
  s: Session;
  active: boolean;
  highlight?: string;
  ctx?: number;
  cost?: number;
  running?: boolean;
  stalled?: boolean;
  updated?: boolean;
  runStart?: number;
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

export function SessionRow({ s, active, highlight, ctx, cost, running, stalled, updated, runStart, pinned, tags = [], onTogglePin, onAddTag, onRemoveTag, onFilterTag, onSelect, onRename, onDescribe, onClose, onDelete, onStop }: SessionRowProps) {
  const { editing, setEditing, draft, setDraft, descEditing, setDescEditing, descDraft, setDescDraft, tagging, setTagging, tagDraft, setTagDraft, inputRef, descRef, tagRef, commit, commitDesc, commitTag } = useSessionRow({ s, onAddTag, onRename, onDescribe });
  const [showDesc] = usePersisted<boolean>(SHOW_SESSION_DESC_KEY, SHOW_SESSION_DESC_DEFAULT);
  const { open: actionsOpen, setOpen: setActionsOpen, consumeTap, handlers } = useLongPress(() => {});
  const warn = ctxWarn(ctx);
  const rowRef = useRef<HTMLDivElement>(null);
  const wasInlineEditing = useRef(false);

  // Fechar a edição inline (Esc/Enter) desmonta o input e o foco cai pro body;
  // devolve pro card. Só quando caiu pro body — clique em outro lugar (blur que
  // também fecha) não deve ter o foco roubado.
  useEffect(() => {
    if (editing || descEditing || tagging) { wasInlineEditing.current = true; return; }
    if (!wasInlineEditing.current) return;
    wasInlineEditing.current = false;
    if (document.activeElement === document.body) rowRef.current?.focus();
  }, [editing, descEditing, tagging]);

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={() => { if (consumeTap()) return; onSelect(s.id); }}
      {...handlers}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return; // tecla foi pra um botão/input interno
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); }
      }}
      className={`group relative cursor-pointer rounded-lg border px-3 py-2.5 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
        ${active
          ? 'glow-active border-orange-500/40 bg-gradient-to-r from-orange-500/[0.09] to-orange-500/[0.03]'
          : 'border-transparent hover:border-neutral-800 hover:bg-neutral-900/80'}`}
    >
      {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-gradient-to-b from-orange-400 to-orange-600" />}
      <div className="mb-1 flex items-start justify-between gap-2">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { e.preventDefault(); setDraft(s.title); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-orange-500/50 bg-neutral-950 px-1.5 py-0.5 text-[12.5px] font-medium text-neutral-100 outline-none ring-2 ring-orange-500/20"
          />
        ) : (
          <span
            className={`flex min-w-0 items-start gap-1.5 text-left text-[13px] font-medium leading-snug tracking-[-0.01em] ${active ? 'text-neutral-50' : 'text-neutral-300 group-hover:text-neutral-200'}`}
          >
            <span className="mt-[3px] shrink-0"><SessionStatusDot running={running} stalled={stalled} updated={updated} /></span>
            {/* Título em até 2 linhas: um título longo mostra bem mais antes de
                reticenciar do que o corte de 1 linha (os "…" que incomodavam). */}
            <span className={`line-clamp-2 ${!running && updated && !active ? 'text-neutral-100' : ''}`}><Highlight text={s.title} term={highlight} /></span>
          </span>
        )}
        {!editing && (
          <SessionRowMeta
            relative={s.relative}
            cost={cost}
            pinned={!!pinned}
            running={!!running}
            tagging={tagging}
            canTag={!!onAddTag}
            canStop={!!onStop}
            canDescribe={!!onDescribe}
            actionsOpen={actionsOpen}
            setActionsOpen={setActionsOpen}
            setTagging={setTagging}
            onTogglePin={onTogglePin ? () => onTogglePin(s.id) : undefined}
            onRename={() => { setDraft(s.title); setEditing(true); }}
            onDescribe={() => { setDescDraft(s.summary || ''); setDescEditing(true); }}
            onStop={onStop ? () => onStop(s.id) : undefined}
            onArchive={() => onClose(s.id)}
            onDelete={() => (onDelete ?? onClose)(s.id)}
          />
        )}
      </div>
      {!editing && (descEditing ? (
        <textarea
          ref={descRef}
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={commitDesc}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitDesc(); }
            if (e.key === 'Escape') { e.preventDefault(); setDescDraft(s.summary || ''); setDescEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          rows={2}
          placeholder="Descrição da sessão…"
          aria-label="Editar descrição da sessão"
          className="mt-0.5 w-full resize-none rounded border border-orange-500/50 bg-neutral-950 px-1.5 py-1 text-[11.5px] leading-snug text-neutral-200 outline-none ring-2 ring-orange-500/20"
        />
      ) : showDesc ? (
        <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-500"><Highlight text={s.summary || s.snippet} term={highlight} /></p>
      ) : null)}
      {!editing && running && (
        <RunStatus start={runStart} stalled={!!stalled} />
      )}
      {/* Faixa única de meta: badges e etiquetas fluem juntos numa linha (com
          wrap) — antes cada badge abria a própria linha e o card crescia torto. */}
      {!editing && (warn || s.hasTerminal || isIdle(s.mtime, !!running) || tags.length > 0 || tagging) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {warn && <Badge tone={warn.tone}>contexto {warn.pct}%</Badge>}
          {s.hasTerminal && <Badge tone="green" dot>terminal</Badge>}
          {isIdle(s.mtime, !!running) && <Badge tone="neutral">ociosa</Badge>}
          {(tags.length > 0 || tagging) && (
            <SessionRowTags
              id={s.id} tags={tags} tagging={tagging} tagDraft={tagDraft} tagRef={tagRef}
              setTagDraft={setTagDraft} setTagging={setTagging} commitTag={commitTag}
              onRemoveTag={onRemoveTag} onFilterTag={onFilterTag}
            />
          )}
        </div>
      )}
    </div>
  );
}
