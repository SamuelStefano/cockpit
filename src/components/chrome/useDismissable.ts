import { useEffect, useRef, useState } from 'react';

// Estado aberto/fechado de um overlay ancorado (popover, dropdown): fecha ao
// clicar fora ou apertar Esc. `pointerdown` cobre toque e mouse — `mousedown`
// sozinho não fechava em alguns webviews de celular.
export function useDismissable<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    // defaultPrevented: um Esc fecha um overlay só — sem isso o mesmo Esc que
    // fecha este popover derrubaria junto a paleta/modal por baixo.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing) { e.preventDefault(); setOpen(false); }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { ref, open, setOpen };
}
