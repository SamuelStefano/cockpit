import type { RefObject } from 'react';
import { Icon } from '../primitives';

interface SessionRowTagsProps {
  id: string;
  tags: string[];
  tagging: boolean;
  tagDraft: string;
  tagRef: RefObject<HTMLInputElement>;
  setTagDraft: (v: string) => void;
  setTagging: (v: boolean) => void;
  commitTag: () => void;
  onRemoveTag?: (id: string, tag: string) => void;
  onFilterTag?: (tag: string) => void;
}

export function SessionRowTags({ id, tags, tagging, tagDraft, tagRef, setTagDraft, setTagging, commitTag, onRemoveTag, onFilterTag }: SessionRowTagsProps) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t} className="group/tag inline-flex items-center gap-0.5 rounded-full border border-sky-500/30 bg-sky-500/[0.08] px-1.5 py-px text-[9.5px] font-medium text-sky-300/90">
          <button onClick={(e) => { e.stopPropagation(); onFilterTag?.(t); }} title={`Filtrar por "${t}"`} className="hover:text-sky-200">#{t}</button>
          {onRemoveTag && (
            <button onClick={(e) => { e.stopPropagation(); onRemoveTag(id, t); }} title="Remover etiqueta" className="text-sky-400/50 hover:text-red-400">
              <Icon name="x" size={9} />
            </button>
          )}
        </span>
      ))}
      {tagging && (
        <input
          ref={tagRef}
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onBlur={commitTag}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTag();
            if (e.key === 'Escape') { setTagDraft(''); setTagging(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="etiqueta…"
          className="w-20 rounded-full border border-sky-500/40 bg-neutral-950 px-1.5 py-px text-[9.5px] text-sky-200 outline-none placeholder-neutral-600"
        />
      )}
    </div>
  );
}
