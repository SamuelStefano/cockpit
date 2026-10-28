import { memo } from 'react';
import { Button, Icon } from './primitives';
import type { Session } from '../data/types';
import { groupByRecency } from './sessions/group-by-recency';
import { SessionGroup } from './sessions/SessionGroup';
import { SessionRow } from './sessions/SessionRow';
import { SessionSkeletonRow } from './sessions/SessionSkeletonRow';
import { BoxSwitcher } from './sessions/BoxSwitcher';
import { ArchivedSection } from './sessions/ArchivedSection';
import { ConfirmArchive } from './sessions/ConfirmArchive';
import { useSessionsPanel } from './sessions/useSessionsPanel';


export interface SessionsPanelProps {
  sessions: Session[];
  loading: boolean;
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  marathon?: Set<string>;
  onToggleMarathon?: (id: string, on: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDescribe?: (id: string, summary: string) => void;
  onClose: (id: string) => void;
  onDelete?: (id: string) => void;
  onStop?: (sessionKey?: string) => void;
  archived?: Session[];
  onUnhide?: (id: string) => void;
  onCloseMobile?: () => void;
  running?: Set<string>;
  stalled?: Set<string>;
  updated?: Set<string>;
  runStart?: Record<string, number>;
  userId?: string;
  // Inside the shell sidebar, which already owns the title and "Nova conversa".
  embedded?: boolean;
}

function SessionsPanelImpl({ sessions, loading, activeId, onSelect, onNew, marathon, onToggleMarathon, onRename, onDescribe, onClose, onDelete, onStop, archived = [], onUnhide, onCloseMobile, running, stalled, updated, runStart = {}, userId, embedded = false }: SessionsPanelProps) {
  const { confirmId, setConfirmId, deleteId, setDeleteId, pinned, togglePin, dismissedWaiting, dismissWaiting, filtered } = useSessionsPanel({ sessions, archived, searchResults: [], userId });

  const renderRow = (s: Session) => (
    <SessionRow key={s.id} s={s} active={s.id === activeId}
      waitingDismissed={dismissedWaiting.has(s.id)} onDismissWaiting={dismissWaiting}
      running={running?.has(s.id)} stalled={stalled?.has(s.id)} updated={updated?.has(s.id)} runStart={runStart[s.id]} pinned={pinned.has(s.id)} onTogglePin={togglePin}
      marathon={marathon?.has(s.id)} onToggleMarathon={onToggleMarathon}
      onSelect={(id) => { onSelect(id); onCloseMobile && onCloseMobile(); }}
      onRename={onRename} onDescribe={onDescribe} onClose={setConfirmId} onDelete={onDelete ? setDeleteId : undefined} onStop={onStop} />
  );

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="shrink-0 px-2.5 pt-1">
        <BoxSwitcher userId={userId} />
      </div>
      {!embedded && (
        <div className="shrink-0 space-y-2 px-2.5 pt-2.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">Conversas</span>
            {onCloseMobile && (
              <button onClick={onCloseMobile} title="Fechar painel de sessões" aria-label="Fechar painel de sessões" className="flex items-center justify-center rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 lg:hidden pointer-coarse:h-11 pointer-coarse:w-11">
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="scroll-thin mt-1.5 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 pb-3">
        {loading && sessions.length === 0 ? (
          <div className="space-y-1.5" role="status" aria-label="Carregando sessões">
            <p className="px-1 text-[11.5px] text-neutral-500">Carregando sessões…</p>
            {Array.from({ length: 4 }).map((_, i) => <SessionSkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? null : (
          groupByRecency(filtered, { now: Date.now(), pinned, running, dismissed: dismissedWaiting }).map((g) => (
            <SessionGroup key={g.label} label={g.label} count={g.items.length}>
              {g.items.map((s) => renderRow(s))}
            </SessionGroup>
          ))
        )}
        {!loading && onUnhide && <ArchivedSection archived={archived} onUnhide={onUnhide} onDelete={onDelete ? setDeleteId : undefined} onView={(id) => { onSelect(id); onCloseMobile && onCloseMobile(); }} />}
      </div>
      {confirmId && (
        <ConfirmArchive
          title={sessions.find((s) => s.id === confirmId)?.title || 'esta sessão'}
          onConfirm={() => { onClose(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)}
        />
      )}
      {deleteId && onDelete && (
        <ConfirmArchive
          mode="delete"
          title={(sessions.find((s) => s.id === deleteId) || archived.find((s) => s.id === deleteId))?.title || 'esta sessão'}
          onConfirm={() => { onDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

// Memoized: App re-renders on every streamed delta, keystroke and 2 s stats frame,
// and none of those touch the sidebar's props (useCockpit.sidebar-stable.test.ts
// pins that). Re-rendering hundreds of rows each time cost ~8 ms per frame.
export const SessionsPanel = memo(SessionsPanelImpl);
