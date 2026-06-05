import { useState, useEffect, useMemo, useRef } from 'react';
import { Icon, Badge } from '../components/primitives';
import { ContextModal, TYPE_TONE } from '../components/ContextModal';
import type { ContextMeta } from '../../shared/protocol';
import type { ContextDoc } from '../useCockpit';

const TYPES = ['user', 'project', 'feedback', 'reference', 'memory'] as const;

function relTime(ms: number): string {
  const d = Date.now() - ms;
  const min = Math.round(d / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

const CHIP_ACTIVE: Record<string, string> = {
  orange: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  green: 'border-green-500/40 bg-green-500/15 text-green-300',
  yellow: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300',
  red: 'border-red-500/40 bg-red-500/15 text-red-300',
  neutral: 'border-neutral-600 bg-neutral-800 text-neutral-200',
};

function Chip({ active, onClick, label, count, tone }: { active: boolean; onClick: () => void; label: string; count: number; tone: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition
        ${active ? (CHIP_ACTIVE[tone] ?? CHIP_ACTIVE.neutral) : 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'}`}
    >
      {label} <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}

function Card({ c, onClick }: { c: ContextMeta; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5 text-left transition hover:-translate-y-px hover:border-orange-500/40 hover:bg-orange-500/[0.05] hover:shadow-lg hover:shadow-black/30"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Badge tone={TYPE_TONE[c.type] ?? 'neutral'}>{c.type}</Badge>
        <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">{relTime(c.mtime)}</span>
      </div>
      <h3 className="mb-1 line-clamp-1 text-[13px] font-medium text-neutral-200 group-hover:text-orange-300">{c.title}</h3>
      <p className="line-clamp-3 text-[12px] leading-snug text-neutral-500">{c.description || '—'}</p>
    </button>
  );
}

function Offline() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        <Icon name="circle" size={20} />
      </div>
      <p className="text-[13px] font-medium text-neutral-300">Backend local indisponível</p>
      <p className="mt-1 max-w-sm text-[12px] leading-snug text-neutral-600">
        Os contextos vivem na sua máquina (<span className="font-mono">memory/</span>) e só aparecem com o backend do cockpit
        rodando em <span className="font-mono">127.0.0.1</span>. Numa URL pública não há conexão com eles.
      </p>
    </div>
  );
}

function Empty({ query }: { query: string }) {
  return (
    <div className="mt-16 flex flex-col items-center px-4 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        <Icon name="sparkles" size={18} />
      </div>
      <p className="text-[12.5px] font-medium text-neutral-400">{query ? 'Nada encontrado' : 'Nenhum contexto ainda'}</p>
      <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
        {query ? <>Nada para «{query}»</> : 'As memórias do agente aparecem aqui assim que forem criadas.'}
      </p>
    </div>
  );
}

interface Props {
  connected: boolean;
  contexts: ContextMeta[];
  openContext: ContextDoc | null;
  onCtxList: () => void;
  onCtxOpen: (id: string) => void;
  onCtxClose: () => void;
}

export function Contextos({ connected, contexts, openContext, onCtxList, onCtxOpen, onCtxClose }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (connected) onCtxList(); }, [connected, onCtxList]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contexts) m[c.type] = (m[c.type] ?? 0) + 1;
    return m;
  }, [contexts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contexts.filter((c) => {
      if (filter && c.type !== filter) return false;
      if (!q) return true;
      return (c.title + ' ' + c.description + ' ' + c.type).toLowerCase().includes(q);
    });
  }, [contexts, query, filter]);

  const openType = openContext ? contexts.find((c) => c.id === openContext.id)?.type : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/80 px-4 py-3">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">contextos</span>
            <Badge tone="neutral">{contexts.length}</Badge>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-neutral-700 focus-within:ring-2 focus-within:ring-orange-500/15">
            <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar contextos…"
              className="w-full bg-transparent text-[12.5px] text-neutral-200 placeholder-neutral-600 outline-none"
            />
            <kbd className="hidden shrink-0 rounded border border-neutral-700 bg-neutral-950 px-1 py-px font-mono text-[9px] text-neutral-500 sm:block">⌘/</kbd>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={filter === null} onClick={() => setFilter(null)} label="todos" count={contexts.length} tone="neutral" />
          {TYPES.map((t) => (counts[t] ? (
            <Chip key={t} active={filter === t} onClick={() => setFilter(filter === t ? null : t)} label={t} count={counts[t]} tone={TYPE_TONE[t]} />
          ) : null))}
        </div>
      </div>

      {!connected ? (
        <Offline />
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <Empty query={query} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => <Card key={c.id} c={c} onClick={() => onCtxOpen(c.id)} />)}
            </div>
          )}
        </div>
      )}

      {openContext && <ContextModal doc={openContext} type={openType} onClose={onCtxClose} />}
    </div>
  );
}
