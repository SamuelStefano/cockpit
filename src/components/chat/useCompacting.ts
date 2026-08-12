import { useEffect, useRef, useState } from 'react';
import type { Message } from '../../data/mock';
import { frameFingerprint, isCompacting, silenceExplained } from './compacting';

// Sem sinal de "começou a compactar" no protocolo, o relógio de vida do turno é a
// impressão digital do último frame: ela muda a cada delta/tool/bolha e re-arma o
// efeito, então o instante capturado é o começo do silêncio. Devolve esse
// instante (pro cronômetro) ou null.
export function useCompacting(messages: Message[], running: boolean, contextTokens: number, quotaPaused = false): number | null {
  const [silentSince, setSilentSince] = useState<number | null>(null);
  // Lido só na batida do relógio: a última bolha muda de forma sem ser frame novo
  // e não pode reiniciar a contagem.
  const msgsRef = useRef(messages);
  useEffect(() => { msgsRef.current = messages; });

  const frame = frameFingerprint(messages);
  useEffect(() => {
    setSilentSince(null);
    if (!running) return;
    const from = Date.now();
    const id = setInterval(() => {
      const on = isCompacting({
        running: true,
        silentMs: Date.now() - from,
        contextTokens,
        quotaPaused,
        explained: silenceExplained(msgsRef.current),
      });
      setSilentSince(on ? from : null);
    }, 1000);
    return () => clearInterval(id);
  }, [frame, running, contextTokens, quotaPaused]);

  return silentSince;
}
