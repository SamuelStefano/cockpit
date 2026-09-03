import { useCallback, useState } from 'react';
import { useDismiss } from './useDismiss';

export function useComposerPlusMenu() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const wrapRef = useDismiss<HTMLDivElement>(open, close);
  // Fecha ANTES de disparar a ação: `input.click()` do seletor de arquivo/câmera
  // tira o foco da página e o menu ficaria aberto atrás do picker nativo.
  const run = useCallback((fn: () => void) => { setOpen(false); fn(); }, []);
  return { open, toggle: () => setOpen((o) => !o), close, run, wrapRef };
}
