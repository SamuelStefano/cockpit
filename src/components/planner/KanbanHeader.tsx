import { Button, Input, ToggleChip, tokens } from '../primitives';
import type { useKanbanFilter } from '../../planner/useKanbanFilter';

interface KanbanHeaderProps {
  filter: ReturnType<typeof useKanbanFilter>;
  total: number;
  onClose: () => void;
}

export function KanbanHeader({ filter, total, onClose }: KanbanHeaderProps) {
  const { query, setQuery, allTags, activeTags, toggleTag, visible, searchRef, filtering } = filter;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-800/80 px-4 py-2.5 max-sm:px-3">
      <h2 className="text-[14px] font-semibold tracking-tight text-neutral-100">Kanban</h2>
      <div className="w-72 max-md:order-last max-md:w-full">
        <Input
          ref={searchRef} size="sm" icon="search" value={query} placeholder="Buscar" aria-label="Buscar tasks"
          suffix={!query && <kbd className="font-mono text-[11px] text-neutral-600 max-md:hidden">/</kbd>}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
        />
      </div>
      {allTags.length > 0 && (
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar por tag">
          {allTags.map((t) => (
            <ToggleChip key={t} icon="tag" on={activeTags.includes(t)} aria-pressed={activeTags.includes(t)} onClick={() => toggleTag(t)}>{t}</ToggleChip>
          ))}
        </div>
      )}
      <span className="ml-auto text-[12px] tabular-nums text-neutral-500">
        {filtering ? `${visible.length} de ${total}` : `${total} tasks`}
      </span>
      <Button variant="ghost" size="sm" square icon="x" onClick={onClose} title="Fechar (Esc)" aria-label="Fechar" className={tokens.touchTarget} />
    </div>
  );
}
