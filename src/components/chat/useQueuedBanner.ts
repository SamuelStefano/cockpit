import { useLayoutEffect, useRef, useState } from 'react';
import { remapOpen } from './queued-open';

// Estado do banner da fila: expansão, flash de reordenação e edição in-place. Tudo é
// keyed por índice, mas QUALQUER mudança na fila (cancelar, drenar o topo, reordenar)
// desloca os índices — por isso o remap por texto é a peça central aqui.
export function useQueuedBanner(
  queued: string[],
  onMove: (i: number, dir: -1 | 1) => void,
  onEdit: (i: number, text: string) => void,
) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [flash, setFlash] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const prevQueued = useRef(queued);
  // Layout effect: corrige antes do paint, senão 1 frame mostrava o vizinho expandido.
  useLayoutEffect(() => {
    if (prevQueued.current === queued) return;
    const prev = prevQueued.current;
    setOpen((o) => remapOpen(prev, queued, o));
    // O textarea segue o MESMO item: se ele drenou ou foi cancelado a edição fecha,
    // em vez de o rascunho pousar sobre o vizinho que herdou o índice.
    setEditing((e) => {
      if (e === null) return null;
      const [k] = Object.keys(remapOpen(prev, queued, { [e]: true }));
      return k === undefined ? null : Number(k);
    });
    prevQueued.current = queued;
  }, [queued]);

  const toggle = (i: number) => setOpen((o) => ({ ...o, [i]: !o[i] }));
  // O flash dá feedback de pra onde o item foi (a lista reordena sem animação).
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    onMove(i, dir);
    setFlash(j);
    window.setTimeout(() => setFlash((f) => (f === j ? null : f)), 700);
  };

  const startEdit = (i: number) => { setEditing(i); setDraft(queued[i] ?? ''); };
  const cancelEdit = () => setEditing(null);
  const commitEdit = () => {
    if (editing === null) return;
    const t = draft.trim();
    if (t && t !== queued[editing]) onEdit(editing, t);
    setEditing(null);
  };

  return { open, toggle, flash, move, editing, draft, setDraft, startEdit, cancelEdit, commitEdit };
}
