import { useState, useEffect, useMemo, useRef } from 'react';
import { Icon, Badge, Button, EmptyState, SkeletonCards } from '../components/primitives';
import { useLoadStalled } from '../lib/useLoadStalled';
import { ContextModal, TYPE_TONE } from '../components/ContextModal';
import type { ContextMeta } from '../../shared/protocol';
import type { ContextDoc } from '../useCockpit';
import { countByType, filterContexts, resolveWikilink } from './contextos.filter';
import { ContextChip } from './contextos/ContextChip';
import { ContextCard } from './contextos/ContextCard';
import { ContextOffline } from './contextos/ContextOffline';
import { ContextEmpty } from './contextos/ContextEmpty';

const TYPES = ['user', 'project', 'feedback', 'reference', 'memory'] as const;

interface Props {
  connected: boolean;
  contexts: ContextMeta[];
  loaded: boolean;
  openContext: ContextDoc | null;
  onCtxList: () => void;
  onCtxOpen: (id: string) => void;
  onCtxClose: () => void;
}

export function Contextos({ connected, contexts, loaded, openContext, onCtxList, onCtxOpen, onCtxClose }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (connected) onCtxList(); }, [connected, onCtxList]);
  const { stalled, retry } = useLoadStalled(loaded, connected);

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

  const counts = useMemo(() => countByType(contexts), [contexts]);
  const filtered = useMemo(() => filterContexts(contexts, query, filter), [contexts, query, filter]);

  const openType = openContext ? contexts.find((c) => c.id === openContext.id)?.type : undefined;

  const openWikilink = (name: string) => {
    const id = resolveWikilink(contexts, name);
    if (id) onCtxOpen(id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/80 px-4 py-3">
        <div className="mb-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3.5 w-1 rounded-full bg-gradient-to-b from-orange-400 to-orange-600" />
            <span className="font-mono text-[15px] font-semibold lowercase tracking-tight text-neutral-100">contextos</span>
            <Badge tone="neutral">{contexts.length}</Badge>
          </div>
          <div className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-neutral-700 focus-within:ring-2 focus-within:ring-orange-500/15 sm:max-w-sm">
            <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar contextos…"
              aria-label="Buscar contextos"
              className="w-full bg-transparent text-[12.5px] text-neutral-200 placeholder-neutral-600 outline-none"
            />
            <kbd className="hidden shrink-0 rounded border border-neutral-700 bg-neutral-950 px-1 py-px font-mono text-[9px] text-neutral-500 sm:block">⌘/</kbd>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ContextChip active={filter === null} onClick={() => setFilter(null)} label="todos" count={contexts.length} tone="neutral" />
          {TYPES.map((t) => (counts[t] ? (
            <ContextChip key={t} active={filter === t} onClick={() => setFilter(filter === t ? null : t)} label={t} count={counts[t]} tone={TYPE_TONE[t]} />
          ) : null))}
        </div>
      </div>

      {!connected ? (
        <ContextOffline />
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          {!loaded ? (
            stalled ? (
              <EmptyState icon="x" title="Não deu pra carregar os contextos" description="O servidor não respondeu com a lista. Tente de novo.">
                <Button icon="rotate" onClick={() => { retry(); onCtxList(); }}>Tentar de novo</Button>
              </EmptyState>
            ) : (
              <SkeletonCards />
            )
          ) : filtered.length === 0 ? (
            <ContextEmpty query={query} />
          ) : (
            <div className="stagger-fade grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => <ContextCard key={c.id} c={c} onClick={() => onCtxOpen(c.id)} />)}
            </div>
          )}
        </div>
      )}

      {openContext && <ContextModal doc={openContext} type={openType} onClose={onCtxClose} onWikilink={openWikilink} />}
    </div>
  );
}
