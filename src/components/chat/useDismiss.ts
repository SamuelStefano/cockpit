import { useEffect, useRef } from 'react';

// Fechar overlay do composer no Esc e no clique fora. `defaultPrevented` evita que
// um Esc já consumido por outro overlay (paleta, parar turno) feche este junto no
// mesmo keypress.
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing) { e.preventDefault(); close(); } };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}
