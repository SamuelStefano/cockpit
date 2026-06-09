import { useState, useRef } from 'react';

export function useComposerDnd(disabled: boolean, uploadFiles: (files: File[]) => number) {
  // Drag-and-drop: contador de profundidade pra o overlay não piscar quando o
  // cursor passa sobre filhos (dragenter/leave borbulham).
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const onDragEnter = (e: React.DragEvent) => {
    if (disabled || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault(); dragDepth.current += 1; setDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (disabled || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!dragging) return;
    e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); }
  };
  const onDrop = (e: React.DragEvent) => {
    dragDepth.current = 0; setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) { e.preventDefault(); uploadFiles(files); }
  };
  // Colar imagem/arquivo do clipboard (print screen, copiar arquivo) vira anexo.
  const onPaste = (e: React.ClipboardEvent) => {
    if (disabled) return;
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length && uploadFiles(files) > 0) e.preventDefault();
  };
  return { dragging, onDragEnter, onDragOver, onDragLeave, onDrop, onPaste };
}
