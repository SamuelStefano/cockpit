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
  e.dataTransfer.setData(TASK_MIME, taskId);
  e.dataTransfer.effectAllowed = 'move';
}
