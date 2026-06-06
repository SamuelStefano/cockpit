import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { Icon, Badge, Skeleton } from './primitives';
import type { Session } from '../data/mock';
import { usePersisted } from '../lib/persist';

function Highlight({ text, term }: { text: string; term?: string }) {
  const q = term?.trim();
  if (!q || q.length < 2) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let hit = lower.indexOf(needle);
  let k = 0;
  while (hit >= 0) {
    if (hit > i) parts.push(text.slice(i, hit));
    parts.push(
      <mark key={k++} className="rounded-[2px] bg-orange-500/25 px-0.5 text-orange-200">
        {text.slice(hit, hit + q.length)}
      </mark>,
    );
    i = hit + q.length;
    hit = lower.indexOf(needle, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}

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

const CTX_WINDOW = 200_000;

interface SessionRowProps {
  s: Session;
  active: boolean;
  highlight?: string;
  ctx?: number;
  running?: boolean;
  updated?: boolean;
  pinned?: boolean;
  onTogglePin?: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClose: (id: string) => void;
}

function SessionRow({ s, active, highlight, ctx, running, updated, pinned, onTogglePin, onSelect, onRename, onClose }: SessionRowProps) {
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
            className={`flex min-w-0 items-center gap-1.5 truncate text-left text-[12.5px] font-medium leading-tight ${active ? 'text-neutral-100' : 'text-neutral-300'} hover:text-orange-300`}
          >
            {running && (
              <span className="relative flex h-1.5 w-1.5 shrink-0" title="Sessão trabalhando agora">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
              </span>
            )}
            {!running && updated && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" title="Novo output desde a última vez que você abriu" />
            )}
            <span className={`truncate ${!running && updated && !active ? 'text-neutral-100' : ''}`}><Highlight text={s.title} term={highlight} /></span>
          </button>
        )}
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {pinned
              ? <span className="text-[10px] tabular-nums text-neutral-600 group-hover:hidden" />
              : <span className="text-[10px] tabular-nums text-neutral-600 group-hover:hidden">{s.relative}</span>}
            {onTogglePin && (
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin(s.id); }}
                title={pinned ? 'Desafixar sessão' : 'Fixar sessão no topo'}
                className={`rounded p-0.5 transition hover:bg-neutral-800
                  ${pinned ? 'text-orange-400 hover:text-orange-300' : 'hidden text-neutral-500 hover:text-orange-300 group-hover:block'}`}
              >
                <Icon name="star" size={12} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
              title="Arquivar sessão (some do sidebar; o histórico não é apagado)"
              className="hidden rounded p-0.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-orange-300 group-hover:block"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        )}
      </div>
      {!editing && (
        <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-500"><Highlight text={s.snippet} term={highlight} /></p>
      )}
      {!editing && ctx !== undefined && ctx > 0 && (() => {
        const pct = Math.min(100, (ctx / CTX_WINDOW) * 100);
        const tone = pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-sky-500/70';
        return (
          <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-neutral-800" title={`${Math.round(ctx / 1000)}k / 200k tokens de contexto (${Math.round(pct)}%)`}>
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
          </div>
        );
      })()}
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
  onClose: (id: string) => void;
  archived?: Session[];
  onUnhide?: (id: string) => void;
  onCloseMobile?: () => void;
  usage?: Record<string, number>;
  running?: Set<string>;
  updated?: Set<string>;
  searchResults?: Session[];
  onSearch?: (q: string) => void;
}

function ArchivedSection({ archived, onUnhide }: { archived: Session[]; onUnhide: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (archived.length === 0) return null;
  return (
    <div className="mt-2 border-t border-neutral-800/70 pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
      >
        <Icon name="chevronRight" size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Arquivadas <span className="tabular-nums text-neutral-600">({archived.length})</span>
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {archived.map((s) => (
            <div key={s.id} className="group flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-neutral-900">
              <span className="truncate text-[11.5px] text-neutral-500">{s.title}</span>
              <button
                onClick={() => onUnhide(s.id)}
                title="Restaurar sessão"
                className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-neutral-500 opacity-0 transition hover:bg-neutral-800 hover:text-orange-300 group-hover:opacity-100"
              >
                restaurar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionsPanel({ sessions, loading, activeId, onSelect, onNew, onRename, onClose, archived = [], onUnhide, onCloseMobile, usage = {}, running, updated, searchResults = [], onSearch }: SessionsPanelProps) {
  const [query, setQuery] = useState('');
  const [pins, setPins] = usePersisted<string[]>('pinned', []);
  const pinned = useMemo(() => new Set(pins), [pins]);
  const togglePin = useCallback((id: string) => {
    setPins((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, [setPins]);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘/ foca a busca de sessões (⌘K virou o command palette). Esc limpa+desfoca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select(); });
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Busca de conteúdo no backend (debounce 150ms). O filtro local (título/snippet)
  // aparece na hora; os hits por CONTEÚDO chegam logo depois e são mesclados.
  useEffect(() => {
    if (!onSearch) return;
    const id = setTimeout(() => onSearch(query), 150);
    return () => clearTimeout(id);
  }, [query, onSearch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? (() => {
          const local = sessions.filter(s => (s.title + ' ' + s.snippet).toLowerCase().includes(q));
          const seen = new Set(local.map(s => s.id));
          return [...local, ...searchResults.filter(s => !seen.has(s.id))]; // hits só-por-conteúdo
        })()
      : sessions;
    // Fixadas sobem ao topo preservando a ordem original entre si.
    if (pinned.size === 0) return base;
    const top = base.filter(s => pinned.has(s.id));
    const rest = base.filter(s => !pinned.has(s.id));
    return [...top, ...rest];
  }, [sessions, query, searchResults, pinned]);

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
              <button onClick={() => { onNew(); onCloseMobile?.(); }} className="mt-3 flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-[12px] font-semibold text-neutral-950 transition hover:bg-orange-400">
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
            <SessionRow key={s.id} s={s} active={s.id === activeId} highlight={query} ctx={usage[s.id]}
              running={running?.has(s.id)} updated={updated?.has(s.id)} pinned={pinned.has(s.id)} onTogglePin={togglePin}
              onSelect={(id) => { onSelect(id); onCloseMobile && onCloseMobile(); }}
              onRename={onRename} onClose={onClose} />
          ))
        )}
        {!loading && !query && onUnhide && <ArchivedSection archived={archived} onUnhide={onUnhide} />}
      </div>
    </div>
  );
}
