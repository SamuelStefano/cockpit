import { useEffect, useRef, useState } from 'react';

// De quanto em quanto o painel ABERTO repede o número. O servidor tem
// single-flight, espaçamento e orçamento por hora, então o custo real é decidido
// lá, não por este tick — ele só garante que a leitura cai enquanto alguém olha.
export const OPEN_REFRESH_MS = 15_000;

export function useUsagePanel(onRefresh?: (force?: boolean) => void) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Ref pra o efeito não remontar (e re-disparar o refresh) a cada render do pai.
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  // Abrir = o usuário CLICOU pra ver: lê agora, sem esperar o espaçamento do poll.
  // Enquanto fica aberto segue pedindo; voltar do background (celular) também
  // conta como "acabei de olhar", senão o painel mostrava o número de antes da tela apagar.
  useEffect(() => {
    if (!open) return;
    refreshRef.current?.(true);
    const id = setInterval(() => refreshRef.current?.(), OPEN_REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshRef.current?.(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
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
