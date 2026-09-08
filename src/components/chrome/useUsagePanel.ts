import { useEffect, useRef, useState } from 'react';

// De quanto em quanto o painel ABERTO repede o número. O servidor tem
// single-flight + piso de 15s entre idas à rede, então o custo real é o do poll
// dele, não o deste tick.
const OPEN_REFRESH_MS = 30_000;

export function useUsagePanel(onRefresh?: () => void) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Ref pra o efeito não remontar (e re-disparar o refresh) a cada render do pai.
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  // Painel aberto = o usuário está OLHANDO o número: pede fresco na abertura e
  // segue pedindo enquanto ficar aberto, em vez de esperar o poll de 5min.
  useEffect(() => {
    if (!open) return;
    refreshRef.current?.();
    const id = setInterval(() => refreshRef.current?.(), OPEN_REFRESH_MS);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    // Um Esc fecha um overlay só: ignora keypress já consumido e marca o que consome.
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing) { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  return { open, setOpen, wrapRef };
}
