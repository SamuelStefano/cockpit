import { useMemo } from 'react';
import { Button, Icon } from './primitives';
import { usePersisted } from '../lib/persist';
import { SHOW_SESSION_DESC_KEY, showSessionDescDefault } from '../lib/prefs';
import type { Session } from '../data/types';
import { groupByRecency } from './sessions/group-by-recency';
import { ambiguousIds } from './sessions/ambiguous';
import { SessionGroup, isStateGroup } from './sessions/SessionGroup';
import { SessionRow } from './sessions/SessionRow';
import { SessionSkeletonRow } from './sessions/SessionSkeletonRow';
import { ArchivedSection } from './sessions/ArchivedSection';
import { ConfirmArchive } from './sessions/ConfirmArchive';
import { TagFilterBar } from './sessions/TagFilterBar';
import { SessionsEmptyState } from './sessions/SessionsEmptyState';
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
  usage?: Record<string, number>;
  cost?: Record<string, number>;
  running?: Set<string>;
  stalled?: Set<string>;
  updated?: Set<string>;
  runStart?: Record<string, number>;
  searchResults?: Session[];
  onSearch?: (q: string) => void;
  userId?: string;
}

export function SessionsPanel({ sessions, loading, activeId, onSelect, onNew, marathon, onToggleMarathon, onRename, onDescribe, onClose, onDelete, onStop, archived = [], onUnhide, onCloseMobile, usage = {}, cost = {}, running, stalled, updated, runStart = {}, searchResults = [], onSearch, userId }: SessionsPanelProps) {
  const {
    query, setQuery, confirmId, setConfirmId, deleteId, setDeleteId, pinned, togglePin,
    tagMap, tagFilter, setTagFilter, addTag, removeTag, allTags, dismissedWaiting, dismissWaiting, searchRef, filtered,
  } = useSessionsPanel({ sessions, archived, searchResults, onSearch, userId });
  const [showDesc, setShowDesc] = usePersisted<boolean>(SHOW_SESSION_DESC_KEY, showSessionDescDefault());
  const ambiguous = useMemo(() => ambiguousIds(filtered), [filtered]);

  const renderRow = (s: Session, inGroup = false) => (
    <SessionRow key={s.id} s={s} active={s.id === activeId} highlight={query} ctx={usage[s.id]} cost={cost[s.id]}
      ambiguous={ambiguous.has(s.id)} inGroup={inGroup}
      waitingDismissed={dismissedWaiting.has(s.id)} onDismissWaiting={dismissWaiting}
      running={running?.has(s.id)} stalled={stalled?.has(s.id)} updated={updated?.has(s.id)} runStart={runStart[s.id]} pinned={pinned.has(s.id)} onTogglePin={togglePin}
      tags={tagMap[s.id]} onAddTag={addTag} onRemoveTag={removeTag} onFilterTag={setTagFilter}
      marathon={marathon?.has(s.id)} onToggleMarathon={onToggleMarathon}
      onSelect={(id) => { onSelect(id); onCloseMobile && onCloseMobile(); }}
      onRename={onRename} onDescribe={onDescribe} onClose={setConfirmId} onDelete={onDelete ? setDeleteId : undefined} onStop={onStop} />
  );

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/80 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Sessões
            {sessions.length > 0 && <span className="ml-1.5 font-medium normal-case tracking-normal text-neutral-600 tabular-nums">{sessions.length}</span>}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowDesc((v) => !v)}
              title={showDesc ? 'Ocultar descrições das sessões' : 'Mostrar descrições das sessões'}
              aria-label="Alternar descrições das sessões"
              aria-pressed={showDesc}
              className={`rounded-md p-1 transition hover:bg-neutral-800 ${showDesc ? 'text-orange-400/80 hover:text-orange-300' : 'text-neutral-600 hover:text-neutral-300'}`}
            >
              <Icon name="message" size={15} />
            </button>
            {onCloseMobile && (
              <button onClick={onCloseMobile} title="Fechar painel de sessões" aria-label="Fechar painel de sessões" className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 lg:hidden">
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 transition-colors focus-within:border-orange-500/30 focus-within:bg-neutral-900 focus-within:ring-2 focus-within:ring-orange-500/15">
          <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sessões…"
            aria-label="Buscar sessões"
            className="w-full bg-transparent text-[12.5px] text-neutral-200 placeholder-neutral-600 outline-hidden"
          />
          <kbd className="hidden shrink-0 rounded-sm border border-neutral-700 bg-neutral-950 px-1 py-px font-mono text-[9px] text-neutral-500 sm:block">⌘/</kbd>
        </div>
      </div>

      <div className="shrink-0 px-2.5 pt-2.5">
        <Button variant="outline" icon="plus" className="w-full" onClick={() => { onNew(); onCloseMobile?.(); }}>
          Nova sessão
        </Button>
      </div>

      <TagFilterBar allTags={allTags} tagFilter={tagFilter} setTagFilter={setTagFilter} clearFilter={() => setTagFilter(null)} />

      <div className="scroll-thin mt-2.5 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-2.5 pb-3">
        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => <SessionSkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <SessionsEmptyState hasSessions={sessions.length > 0} query={query} tagFilter={tagFilter} onNew={onNew} onCloseMobile={onCloseMobile} />
        ) : query ? (
          filtered.map((s) => renderRow(s))
        ) : (
          groupByRecency(filtered, { now: Date.now(), pinned, running, dismissed: dismissedWaiting }).map((g) => (
            <SessionGroup key={g.label} label={g.label} count={g.items.length}>
              {g.items.map((s) => renderRow(s, isStateGroup(g.label)))}
            </SessionGroup>
          ))
        )}
        {!loading && !query && onUnhide && <ArchivedSection archived={archived} onUnhide={onUnhide} onDelete={onDelete ? setDeleteId : undefined} onView={(id) => { onSelect(id); onCloseMobile && onCloseMobile(); }} />}
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
