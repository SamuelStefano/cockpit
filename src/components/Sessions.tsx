import { Icon } from './primitives';
import type { Session } from '../data/mock';
import { groupByRecency } from './sessions/group-by-recency';
import { SessionRow } from './sessions/SessionRow';
import { SessionSkeletonRow } from './sessions/SessionSkeletonRow';
import { ArchivedSection } from './sessions/ArchivedSection';
import { ConfirmArchive } from './sessions/ConfirmArchive';
import { TagFilterBar } from './sessions/TagFilterBar';
import { SessionsEmptyState } from './sessions/SessionsEmptyState';
import { useSessionsPanel } from './sessions/useSessionsPanel';

export { groupByRecency } from './sessions/group-by-recency';

export interface SessionsPanelProps {
  sessions: Session[];
  loading: boolean;
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
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
}

export function SessionsPanel({ sessions, loading, activeId, onSelect, onNew, onRename, onDescribe, onClose, onDelete, onStop, archived = [], onUnhide, onCloseMobile, usage = {}, cost = {}, running, stalled, updated, runStart = {}, searchResults = [], onSearch }: SessionsPanelProps) {
  const {
    query, setQuery, confirmId, setConfirmId, deleteId, setDeleteId, pinned, togglePin,
    tagMap, tagFilter, setTagFilter, addTag, removeTag, allTags, searchRef, filtered,
  } = useSessionsPanel({ sessions, searchResults, onSearch });

  const renderRow = (s: Session) => (
    <SessionRow key={s.id} s={s} active={s.id === activeId} highlight={query} ctx={usage[s.id]} cost={cost[s.id]}
      running={running?.has(s.id)} stalled={stalled?.has(s.id)} updated={updated?.has(s.id)} runStart={runStart[s.id]} pinned={pinned.has(s.id)} onTogglePin={togglePin}
      tags={tagMap[s.id]} onAddTag={addTag} onRemoveTag={removeTag} onFilterTag={setTagFilter}
      onSelect={(id) => { onSelect(id); onCloseMobile && onCloseMobile(); }}
      onRename={onRename} onDescribe={onDescribe} onClose={setConfirmId} onDelete={onDelete ? setDeleteId : undefined} onStop={onStop} />
  );

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/80 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Sessões</span>
          {onCloseMobile && (
            <button onClick={onCloseMobile} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 lg:hidden">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-neutral-700 focus-within:ring-2 focus-within:ring-orange-500/15">
          <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sessões…"
            className="w-full bg-transparent text-[12.5px] text-neutral-200 placeholder-neutral-600 outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-neutral-700 bg-neutral-950 px-1 py-px font-mono text-[9px] text-neutral-500 sm:block">⌘/</kbd>
        </div>
      </div>

      <div className="shrink-0 px-2.5 pt-2.5">
        <button
          onClick={() => { onNew(); onCloseMobile?.(); }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 py-2 text-[12.5px] font-medium text-neutral-200 transition hover:border-orange-500/40 hover:bg-orange-500/[0.06] hover:text-orange-300"
        >
          <Icon name="plus" size={15} /> Nova sessão
        </button>
      </div>

      <TagFilterBar allTags={allTags} tagFilter={tagFilter} setTagFilter={setTagFilter} clearFilter={() => setTagFilter(null)} />

      <div className="scroll-thin mt-2.5 flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => <SessionSkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <SessionsEmptyState hasSessions={sessions.length > 0} query={query} tagFilter={tagFilter} onNew={onNew} onCloseMobile={onCloseMobile} />
        ) : query ? (
          filtered.map((s) => renderRow(s))
        ) : (
          groupByRecency(filtered, pinned, running).map((g) => (
            <div key={g.label} className="space-y-1">
              <div className={`sticky top-0 z-[1] -mx-2.5 bg-neutral-950/95 px-3.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm ${g.label === 'Trabalhando agora' ? 'text-green-400/80' : 'text-neutral-600'}`}>
                {g.label === 'Fixadas' && <Icon name="star" size={9} className="mr-1 inline -translate-y-px text-orange-400/80" />}
                {g.label === 'Trabalhando agora' && <span className="mr-1 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-green-400" />}
                {g.label}
              </div>
              {g.items.map((s) => renderRow(s))}
            </div>
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
