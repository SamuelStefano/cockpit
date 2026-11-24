import { useState, type DragEvent } from 'react';

export const TASK_MIME = 'application/x-deck-task';

// A delivery accepts a task row dropped on it. Only our own MIME type counts, so
// dragging text or a file over the page does nothing.
export function useDropZone(onDrop: (taskId: string) => void) {
  const [over, setOver] = useState(false);
  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(TASK_MIME);
  return {
    over,
    bind: {
      onDragOver: (e: DragEvent) => { if (!accepts(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!over) setOver(true); },
      onDragLeave: (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); },
      onDrop: (e: DragEvent) => {
        if (!accepts(e)) return;
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData(TASK_MIME);
        if (id) onDrop(id);
      },
    },
  };
}

export function dragTask(e: DragEvent, taskId: string): void {
  // The row is draggable and holds inline editors: selecting text in an open
  // title/points field with the mouse started a row drag instead.
  const row = e.currentTarget as HTMLElement | null;
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  const fromField = (e.target as HTMLElement | null)?.closest?.('input:not([type="checkbox"]),textarea,[contenteditable="true"]');
  if (fromField || (row && active && active !== row && row.contains(active) && active.matches('input:not([type="checkbox"]),textarea'))) {
    e.preventDefault();
    return;
  }
  e.dataTransfer.setData(TASK_MIME, taskId);
  e.dataTransfer.effectAllowed = 'move';
}
