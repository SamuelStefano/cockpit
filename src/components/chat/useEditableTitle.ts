import { useState, useEffect, useRef } from 'react';

interface Args {
  id?: string;
  title: string;
  onRename?: (id: string, title: string) => void;
}

export function useEditableTitle({ id, title, onRename }: Args) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Troca de sessão ou rename por fora (sidebar/remoto): re-sincroniza e fecha a edição.
  useEffect(() => { setDraft(title); setEditing(false); }, [id, title]);

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

  const start = () => { if (id && onRename) { setDraft(title); setEditing(true); } };
  const commit = () => {
    const v = draft.trim();
    if (id && onRename && v && v !== title) onRename(id, v);
    else setDraft(title);
    setEditing(false);
  };
  const cancel = () => { setDraft(title); setEditing(false); };

  return { editing, draft, setDraft, inputRef, start, commit, cancel };
}
