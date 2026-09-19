import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchBuild, hasUpdate, loadedEntry } from './app-update';

const POLL_MS = 5 * 60 * 1000;

// Descobre que o servidor passou a servir um bundle diferente do que esta aba
// carregou. Existe por causa da PWA instalada: na home screen do iPhone o Deck fica
// aberto por dias sem nunca recarregar, então o deploy novo no disco não chega até
// ele. Numa aba normal um F5 resolve — a PWA não tem F5.
//
// Três gatilhos, do mais barato pro mais raro: voltar pro app (visibilitychange é o
// momento exato em que ele reabre na home screen), reconectar o WS (o redeploy DERRUBA
// o WS, então a reconexão é o sinal mais próximo do deploy) e um poll lento de rede
// de segurança pra aba que fica visível e conectada o dia inteiro.
export function useAppUpdate(connected: boolean): { updateReady: boolean; applyUpdate: () => void } {
  const mine = useRef<string | null>(null);
  if (mine.current === null) mine.current = loadedEntry();
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (updateReady || !mine.current) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      if (hasUpdate(mine.current, await fetchBuild(ctrl.signal))) setUpdateReady(true);
    };
    const loop = () => { timer = setTimeout(() => { void check(); loop(); }, POLL_MS); };

    void check();
    loop();
    document.addEventListener('visibilitychange', check);
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
    // `connected` entra como dependência pra remontar o efeito (e checar na hora) a
    // cada reconexão do WS.
  }, [updateReady, connected]);

  const applyUpdate = useCallback(() => {
    // O SW do Deck não guarda bundle (globPatterns vazio), então o reload já basta;
    // o update() é pro próprio SW não ficar uma versão atrás depois do deploy.
    void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    location.reload();
  }, []);

  return { updateReady, applyUpdate };
}
