import { Icon } from '../primitives';
import { InlineEdit } from './InlineEdit';

interface SessionRowTagsProps {
  id: string;
  tags: string[];
  tagging: boolean;
  tagDraft: string;
  setTagDraft: (v: string) => void;
  setTagging: (v: boolean) => void;
  commitTag: () => void;
  onRemoveTag?: (id: string, tag: string) => void;
  onFilterTag?: (tag: string) => void;
}

export function SessionRowTags({ id, tags, tagging, tagDraft, setTagDraft, setTagging, commitTag, onRemoveTag, onFilterTag }: SessionRowTagsProps) {
  // Sem wrapper próprio: as etiquetas fluem na faixa de meta do card, junto dos
  // badges de estado, em vez de abrir mais uma linha.
  return (
    <div className="contents">
      {tags.map((t) => (
        <span key={t} className="group/tag inline-flex items-center gap-0.5 rounded-full border border-sky-500/30 bg-sky-500/8 px-1.5 py-px text-[9.5px] font-medium text-sky-300/90">
          <button onClick={(e) => { e.stopPropagation(); onFilterTag?.(t); }} title={`Filtrar por "${t}"`} className="hover:text-sky-200">#{t}</button>
          {onRemoveTag && (
            <button onClick={(e) => { e.stopPropagation(); onRemoveTag(id, t); }} title="Remover etiqueta" className="text-sky-400/50 hover:text-red-400">
              <Icon name="x" size={9} />
            </button>
          )}
        </span>
      ))}
      {tagging && (
        <InlineEdit
          label="Adicionar etiqueta"
          value={tagDraft} onChange={setTagDraft} onCommit={commitTag}
          onCancel={() => { setTagDraft(''); setTagging(false); }}
          placeholder="etiqueta…"
          className="w-20 rounded-full border border-sky-500/40 bg-neutral-950 px-1.5 py-px text-[9.5px] text-sky-200 outline-hidden placeholder-neutral-600"
        />
      )}
    </div>
  );
}
