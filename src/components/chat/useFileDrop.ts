import { useState, useRef } from 'react';

// Drop de arquivos reutilizável: serve tanto o composer quanto o painel inteiro do
// chat (anexar em qualquer lugar). Quem monta no composer chama stopOnDrop=true pra
// o evento NÃO borbulhar até o painel — senão o mesmo arquivo subiria duas vezes.
export function useFileDrop(uploadFiles: (files: File[]) => number, stopOnDrop = false) {
  // Contador de profundidade pra o overlay não piscar quando o cursor passa sobre
  // filhos (dragenter/leave borbulham por toda a subárvore).
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    if (stopOnDrop) e.stopPropagation();
    dragDepth.current += 1; setDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    if (stopOnDrop) e.stopPropagation();
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!dragging) return;
    e.preventDefault();
    if (stopOnDrop) e.stopPropagation();
    dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); }
  };
  const onDrop = (e: React.DragEvent) => {
    dragDepth.current = 0; setDragging(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) { e.preventDefault(); if (stopOnDrop) e.stopPropagation(); uploadFiles(files); }
  };
  // Colar imagem/arquivo do clipboard (print screen, copiar arquivo) vira anexo.
  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length && uploadFiles(files) > 0) e.preventDefault();
  };
  return { dragging, onDragEnter, onDragOver, onDragLeave, onDrop, onPaste };
}
