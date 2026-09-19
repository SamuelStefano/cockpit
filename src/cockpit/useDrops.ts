import { useCallback, useState } from 'react';
import type { ClientMsg, DropRef, ServerMsg } from '../../shared/protocol';

// Superfície que a UI consome (o onMsg é canal interno do useCockpit).
export type DropApi = Omit<Drops, 'onMsg'>;

export interface Drops {
  drops: DropRef[];
  dropsLoaded: boolean;
  lastDrop: DropRef | null;
  onDropList: () => void;
  // Devolve se o frame saiu: com o socket fechado o envio é descartado em silêncio e
  // o formulário não pode limpar o segredo achando que gravou.
  onDropPut: (slug: string, content: string, ttlMs?: number) => boolean;
  onDropRm: (slug: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

// Drop privado no cliente: guarda SÓ referências (slug/caminho/bytes/sha256). O
// conteúdo do frame `drop` é ignorado de propósito — pôr o segredo em estado do
// React o faria aparecer em render, devtools e, no caminho do chat, no transcript.
// Por isso também não há ação de drop-open aqui: o consumo certo é o agente
// alimentar env.json/Infisical/script com o arquivo, sem imprimir.
export function useDrops(send: (m: ClientMsg) => boolean): Drops {
  const [drops, setDrops] = useState<DropRef[]>([]);
  const [dropsLoaded, setDropsLoaded] = useState(false);
  const [lastDrop, setLastDrop] = useState<DropRef | null>(null);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t === 'drops') {
      setDrops(msg.items);
      setDropsLoaded(true);
      return true;
    }
    if (msg.t === 'drop') {
      setLastDrop(msg.ref);
      return true;
    }
    return false;
  }, []);

  return {
    drops,
    dropsLoaded,
    lastDrop,
    onDropList: useCallback(() => { send({ t: 'drop-list' }); }, [send]),
    onDropPut: useCallback((slug: string, content: string, ttlMs?: number) => send({ t: 'drop-put', slug, content, ttlMs }), [send]),
    onDropRm: useCallback((slug: string) => { send({ t: 'drop-rm', slug }); }, [send]),
    onMsg,
  };
}
