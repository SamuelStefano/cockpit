import { usePersisted } from '../../lib/persist';
import { SHOW_SESSION_DESC_KEY, showSessionDescDefault } from '../../lib/prefs';
import type { Session } from '../../data/types';
import { Highlight } from './Highlight';
import { SessionStatusDot } from './SessionStatusDot';
import { SessionRowMeta } from './SessionRowMeta';
import { SessionRowBadges } from './SessionRowBadges';
import { RunStatus } from './RunStatus';
import { useSessionRow } from './useSessionRow';
import { InlineEdit } from './InlineEdit';
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
  marathon?: boolean;
  onToggleMarathon?: (id: string, on: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDescribe?: (id: string, summary: string) => void;
  onClose: (id: string) => void;
  onDelete?: (id: string) => void;
  onStop?: (id: string) => void;
  waitingDismissed?: boolean;
  onDismissWaiting?: (id: string) => void;
}

export function SessionRow({ s, active, highlight, ctx, cost, running, stalled, updated, runStart, pinned, tags = [], marathon, onToggleMarathon, onTogglePin, onAddTag, onRemoveTag, onFilterTag, onSelect, onRename, onDescribe, onClose, onDelete, onStop, waitingDismissed, onDismissWaiting }: SessionRowProps) {
  const { editing, setEditing, draft, setDraft, descEditing, setDescEditing, descDraft, setDescDraft, tagging, setTagging, tagDraft, setTagDraft, rowRef, commit, commitDesc, commitTag } = useSessionRow({ s, onAddTag, onRename, onDescribe });
  const [showDesc] = usePersisted<boolean>(SHOW_SESSION_DESC_KEY, showSessionDescDefault());
  const { open: actionsOpen, setOpen: setActionsOpen, consumeTap, handlers } = useLongPress(() => {});
  const warn = ctxWarn(ctx);

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
      className={`group relative cursor-pointer rounded-xl border px-3.5 py-2 transition-all duration-150 outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 lg:py-3
        ${active
          ? 'glow-active border-orange-500/40 bg-linear-to-r from-orange-500/9 to-orange-500/3'
          : 'border-transparent hover:border-neutral-800 hover:bg-neutral-900/80'}`}
    >
      {active && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-linear-to-b from-orange-400 to-orange-600" />}
      <div className="mb-1.5 flex items-start justify-between gap-2">
        {editing ? (
          <InlineEdit
            value={draft} onChange={setDraft} onCommit={commit}
            onCancel={() => { setDraft(s.title); setEditing(false); }}
            label="Editar título da sessão"
            className="w-full rounded-sm border border-orange-500/50 bg-neutral-950 px-1.5 py-0.5 text-[12.5px] font-medium text-neutral-100 outline-hidden ring-2 ring-orange-500/20"
          />
        ) : (
          <span
            className={`flex min-w-0 items-start gap-1.5 text-left text-[13.5px] font-medium leading-snug tracking-[-0.01em] ${active ? 'text-neutral-50' : 'text-neutral-300 group-hover:text-neutral-200'}`}
          >
            <span className="mt-[3px] shrink-0"><SessionStatusDot running={running} stalled={stalled} updated={updated} waiting={s.waiting} /></span>
            {/* Título em até 2 linhas no desktop: um título longo mostra bem mais
                antes de reticenciar. No celular, 2 linhas × 99 sessões viram uma
                lista de 5 itens por tela — ali vale mais ver mais sessões. */}
            <span className={`line-clamp-1 lg:line-clamp-2 ${!running && updated && !active ? 'text-neutral-100' : ''}`}><Highlight text={s.title} term={highlight} /></span>
          </span>
        )}
        {!editing && (
          <SessionRowMeta
            relative={s.relative}
            pinned={!!pinned}
            running={!!running}
            tagging={tagging}
            canTag={!!onAddTag}
            canStop={!!onStop}
            canDescribe={!!onDescribe}
            marathon={!!marathon}
            canDismissWaiting={!!s.waiting && !waitingDismissed}
            onDismissWaiting={onDismissWaiting ? () => onDismissWaiting(s.id) : undefined}
            onToggleMarathon={onToggleMarathon ? () => onToggleMarathon(s.id, !marathon) : undefined}
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
        <InlineEdit
          multiline rows={2}
          value={descDraft} onChange={setDescDraft} onCommit={commitDesc}
          onCancel={() => { setDescDraft(s.summary || ''); setDescEditing(false); }}
          placeholder="Descrição da sessão…"
          label="Editar descrição da sessão"
          className="mt-0.5 w-full resize-none rounded-sm border border-orange-500/50 bg-neutral-950 px-1.5 py-1 text-[11.5px] leading-snug text-neutral-200 outline-hidden ring-2 ring-orange-500/20"
        />
      ) : showDesc ? (
        <p className="line-clamp-2 text-[12px] leading-snug text-neutral-500"><Highlight text={s.summary || s.snippet} term={highlight} /></p>
      ) : null)}
      {!editing && running && (
        <RunStatus start={runStart} stalled={!!stalled} />
      )}
      {/* Faixa única de meta: badges e etiquetas fluem juntos numa linha (com
          wrap) — antes cada badge abria a própria linha e o card crescia torto. */}
      {!editing && (
        <SessionRowBadges
          id={s.id} cost={cost} warn={warn} hasTerminal={s.hasTerminal} idle={isIdle(s.mtime, !!running)}
          tags={tags} tagging={tagging} tagDraft={tagDraft}
          setTagDraft={setTagDraft} setTagging={setTagging} commitTag={commitTag}
          onRemoveTag={onRemoveTag} onFilterTag={onFilterTag}
        />
      )}
    </div>
  );
}
