import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, Badge, Skeleton } from './primitives';
import type { Session } from '../data/mock';

function SessionSkeletonRow() {
  return (
    <div className="rounded-lg border border-neutral-800/60 px-2.5 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-10" />
      </div>
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="mt-1.5 h-2.5 w-3/5" />
    </div>
  );
}

interface SessionRowProps {
  s: Session;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

function SessionRow({ s, active, onSelect, onRename }: SessionRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    if (v) onRename(s.id, v); else setDraft(s.title);
    setEditing(false);
  };

  return (
    <div
      onClick={() => onSelect(s.id)}
      className={`group relative cursor-pointer rounded-lg border px-2.5 py-2 transition
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
            className={`truncate text-left text-[12.5px] font-medium leading-tight ${active ? 'text-neutral-100' : 'text-neutral-300'} hover:text-orange-300`}
          >
            {s.title}
          </button>
        )}
        {!editing && <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">{s.relative}</span>}
      </div>
      {!editing && (
        <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-500">{s.snippet}</p>
      )}
      {s.hasTerminal && !editing && (
        <div className="mt-1.5">
          <Badge tone="green" dot>terminal ativo</Badge>
        </div>
      )}
    </div>
  );
}

export interface SessionsPanelProps {
  sessions: Session[];
  loading: boolean;
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onCloseMobile?: () => void;
}

export function SessionsPanel({ sessions, loading, activeId, onSelect, onNew, onRename, onCloseMobile }: SessionsPanelProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(s => (s.title + ' ' + s.snippet).toLowerCase().includes(q));
  }, [sessions, query]);

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/80 p-2.5">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Sessões</span>
          {onCloseMobile && (
            <button onClick={onCloseMobile} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 lg:hidden">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-neutral-700 focus-within:ring-2 focus-within:ring-orange-500/15">
          <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sessões…"
            className="w-full bg-transparent text-[12.5px] text-neutral-200 placeholder-neutral-600 outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-neutral-700 bg-neutral-950 px-1 py-px font-mono text-[9px] text-neutral-500 sm:block">⌘K</kbd>
        </div>
      </div>

      <div className="shrink-0 px-2.5 pt-2.5">
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 py-2 text-[12.5px] font-medium text-neutral-200 transition hover:border-orange-500/40 hover:bg-orange-500/[0.06] hover:text-orange-300"
        >
          <Icon name="plus" size={15} /> Nova sessão
        </button>
      </div>

      <div className="scroll-thin mt-2.5 flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => <SessionSkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          sessions.length === 0 ? (
            <div className="mt-10 flex flex-col items-center px-4 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
                <Icon name="message" size={18} />
              </div>
              <p className="text-[12.5px] font-medium text-neutral-400">Nenhuma sessão ainda</p>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">Crie uma para começar a conversar com o agente.</p>
              <button onClick={onNew} className="mt-3 flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-[12px] font-semibold text-neutral-950 transition hover:bg-orange-400">
                <Icon name="plus" size={14} /> Criar sessão
              </button>
            </div>
          ) : (
            <div className="mt-8 text-center text-[12px] text-neutral-600">
              Nada encontrado para <span className="text-neutral-400">"{query}"</span>
            </div>
          )
        ) : (
          filtered.map((s) => (
            <SessionRow key={s.id} s={s} active={s.id === activeId}
              onSelect={(id) => { onSelect(id); onCloseMobile && onCloseMobile(); }}
              onRename={onRename} />
          ))
        )}
      </div>
    </div>
  );
}
