import { Icon } from '../primitives';

interface TagFilterBarProps {
  allTags: string[];
  tagFilter: string | null;
  setTagFilter: (fn: (cur: string | null) => string | null) => void;
  clearFilter: () => void;
}

export function TagFilterBar({ allTags, tagFilter, setTagFilter, clearFilter }: TagFilterBarProps) {
  if (allTags.length === 0) return null;
  return (
    <div className="scroll-thin shrink-0 overflow-x-auto px-2.5 pt-2">
      <div className="flex items-center gap-1.5">
        {tagFilter && (
          <button
            onClick={clearFilter}
            title="Limpar filtro de etiqueta"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
          >
            <Icon name="x" size={9} /> limpar
          </button>
        )}
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition
              ${tagFilter === t
                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                : 'border-sky-500/20 bg-sky-500/[0.05] text-sky-300/70 hover:border-sky-500/45 hover:bg-sky-500/10 hover:text-sky-200'}`}
          >
            #{t}
          </button>
        ))}
      </div>
    </div>
  );
}
