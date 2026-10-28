import type { Session } from '../../data/types';
import { SessionRowActions } from './SessionRowActions';
import { useSessionRow } from './useSessionRow';
import { useRunClock } from './useRunClock';
import { InlineEdit } from './InlineEdit';
import { useLongPress } from './useLongPress';
import { rowStatus, STATUS_DOT } from './row-status';

export interface SessionRowProps {
  s: Session;
  active: boolean;
  running?: boolean;
  stalled?: boolean;
  updated?: boolean;
  runStart?: number;
  pinned?: boolean;
  onTogglePin?: (id: string) => void;
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

// One conversation: a dot (only when something is going on) and the title.
export function SessionRow({ s, active, running, stalled, updated, runStart, pinned, marathon, onToggleMarathon, onTogglePin, onSelect, onRename, onDescribe, onClose, onDelete, onStop, waitingDismissed, onDismissWaiting }: SessionRowProps) {
  const { editing, setEditing, draft, setDraft, setDescEditing, setDescDraft, rowRef, commit } = useSessionRow({ s, onRename, onDescribe });
  const { open: actionsOpen, setOpen: setActionsOpen, consumeTap, handlers } = useLongPress(() => {});
  const now = useRunClock(!!running);
  const status = rowStatus({ running, stalled, waiting: s.waiting, runStart, relative: s.relative, now });
  const dot = status ? STATUS_DOT[status.tone] : !running && updated ? 'bg-orange-400' : null;

  return (
    <div
      ref={rowRef}
      onClick={() => { if (consumeTap()) return; onSelect(s.id); }}
      {...handlers}
      className={`row-in group relative flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2.5 transition-colors duration-150 outline-hidden has-[[data-row-select]:focus-visible]:ring-2 has-[[data-row-select]:focus-visible]:ring-orange-500/40 pointer-coarse:h-11 pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]
        ${active ? 'bg-neutral-800 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-orange-500' : 'hover:bg-neutral-800/70'}`}
    >
      {editing ? (
        <InlineEdit
          value={draft} onChange={setDraft} onCommit={commit}
          onCancel={() => { setDraft(s.title); setEditing(false); }}
          label="Editar título da sessão"
          className="w-full select-text rounded-sm border border-orange-500/50 bg-neutral-950 px-1.5 py-0.5 text-[13px] text-neutral-100 outline-hidden ring-2 ring-orange-500/20"
        />
      ) : (
        <button
          type="button"
          data-row-select=""
          aria-current={active ? 'true' : undefined}
          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-[13px] outline-hidden ${active ? 'font-medium text-neutral-50' : 'text-neutral-300 group-hover:text-neutral-100'}`}
        >
          {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} title={status?.title ?? 'Novo output desde a última vez que você abriu'} />}
          <span className="truncate" title={s.title}>{s.title}</span>
        </button>
      )}
      {!editing && s.relative && (
        <span className="shrink-0 text-[11px] tabular-nums text-neutral-500 transition-opacity sm:pointer-fine:group-hover:opacity-0" data-row-meta="">{s.relative}</span>
      )}
      {!editing && (
        <SessionRowActions
          pinned={!!pinned}
          running={!!running}
          canStop={!!onStop}
          canDescribe={!!onDescribe}
          marathon={!!marathon}
          canDismissWaiting={!!s.waiting && !waitingDismissed}
          onDismissWaiting={onDismissWaiting ? () => onDismissWaiting(s.id) : undefined}
          onToggleMarathon={onToggleMarathon ? () => onToggleMarathon(s.id, !marathon) : undefined}
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          onTogglePin={onTogglePin ? () => onTogglePin(s.id) : undefined}
          onRename={() => { setDraft(s.title); setEditing(true); }}
          onDescribe={() => { setDescDraft(s.summary || ''); setDescEditing(true); }}
          onStop={onStop ? () => onStop(s.id) : undefined}
          onArchive={() => onClose(s.id)}
          onDelete={() => (onDelete ?? onClose)(s.id)}
        />
      )}
    </div>
  );
}
