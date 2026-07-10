import { useEditableTitle } from './useEditableTitle';

interface EditableTitleProps {
  id?: string;
  title: string;
  editable: boolean;
  onRename?: (id: string, title: string) => void;
}

export function EditableTitle({ id, title, editable, onRename }: EditableTitleProps) {
  const { editing, draft, setDraft, inputRef, start, commit, cancel } = useEditableTitle({ id, title, onRename });

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        className="min-w-0 flex-1 rounded border border-orange-700/60 bg-neutral-800 px-1 py-0.5 text-[12.5px] font-medium text-neutral-100 outline-none"
      />
    );
  }

  if (!editable) {
    return <span className="truncate text-[12.5px] font-medium text-neutral-300">{title}</span>;
  }

  return (
    <button
      onClick={start}
      title="Renomear sessão"
      className="min-w-0 truncate rounded px-1 py-0.5 text-left text-[12.5px] font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-neutral-100"
    >
      {title}
    </button>
  );
}
