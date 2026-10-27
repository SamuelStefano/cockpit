import { useEffect } from 'react';
import { useEditableTitle } from './useEditableTitle';
import { tokens } from '../primitives';

interface EditableTitleProps {
  id?: string;
  title: string;
  editable: boolean;
  onRename?: (id: string, title: string) => void;
  startSignal?: number;
}

export function EditableTitle({ id, title, editable, onRename, startSignal = 0 }: EditableTitleProps) {
  const { editing, draft, setDraft, inputRef, start, commit, cancel } = useEditableTitle({ id, title, onRename });
  useEffect(() => { if (startSignal > 0) start(); }, [startSignal]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        aria-label="Nome da sessão"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        className="min-w-0 flex-1 rounded-sm border border-orange-700/60 bg-neutral-800 px-1 py-0.5 text-[14px] font-medium text-neutral-100 outline-hidden"
      />
    );
  }

  if (!editable) {
    return <span className="truncate text-[14px] font-medium text-neutral-100">{title}</span>;
  }

  return (
    <button
      onClick={start}
      title="Renomear sessão"
      aria-label={`Renomear sessão: ${title}`}
      className={`min-w-0 truncate rounded-sm px-2 py-1 text-left text-[14px] font-medium text-neutral-100 transition hover:bg-neutral-900 ${tokens.focusRing}`}
    >
      {title}
    </button>
  );
}
