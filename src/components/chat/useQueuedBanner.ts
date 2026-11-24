import { useEffect, useState } from 'react';

// Banner state (expanded rows, reorder flash, in-place edit, background launcher) keyed
// by the queue item's stable wire id. Index keys drifted whenever the queue changed
// (cancel, drain from the top, reorder) and the state landed on a neighbour.
export function useQueuedBanner(
  queued: string[],
  ids: string[],
  onMove: (i: number, dir: -1 | 1) => void,
  onEdit: (i: number, text: string) => void,
) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [bgOpen, setBgOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // Editor and launcher close when their item leaves the queue.
  useEffect(() => {
    setEditing((e) => (e !== null && !ids.includes(e) ? null : e));
    setBgOpen((b) => (b !== null && !ids.includes(b) ? null : b));
  }, [ids]);

  const textOf = (id: string) => queued[ids.indexOf(id)] ?? '';
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const move = (id: string, dir: -1 | 1) => {
    onMove(ids.indexOf(id), dir);
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 700);
  };

  const toggleBg = (id: string) => setBgOpen((b) => (b === id ? null : id));
  const startEdit = (id: string) => { setEditing(id); setDraft(textOf(id)); };
  const cancelEdit = () => setEditing(null);
  const commitEdit = () => {
    if (editing === null) return;
    const t = draft.trim();
    if (t && t !== textOf(editing)) onEdit(ids.indexOf(editing), t);
    setEditing(null);
  };

  return { open, toggle, flash, move, editing, bgOpen, toggleBg, draft, setDraft, startEdit, cancelEdit, commitEdit };
}
