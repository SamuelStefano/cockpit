import { useCallback, useState } from 'react';
import type { ClientMsg, ContextMeta, ServerMsg } from '../../shared/protocol';

export interface ContextDoc { id: string; title: string; body: string }

export interface Contexts {
  contexts: ContextMeta[];
  ctxLoaded: boolean;
  openContext: ContextDoc | null;
  onCtxList: () => void;
  onCtxOpen: (id: string) => void;
  onCtxClose: () => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useContexts(send: (m: ClientMsg) => boolean): Contexts {
  const [contexts, setContexts] = useState<ContextMeta[]>([]);
  // Lista vazia ≠ "ainda não chegou": o flag separa skeleton (esperando o 1º
  // snapshot) de estado vazio de verdade (zero contextos no disco).
  const [ctxLoaded, setCtxLoaded] = useState(false);
  const [openContext, setOpenContext] = useState<ContextDoc | null>(null);

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'contexts':
        setContexts(msg.items);
        setCtxLoaded(true);
        return true;
      case 'context':
        setOpenContext({ id: msg.id, title: msg.title, body: msg.body });
        return true;
      default:
        return false;
    }
  }, []);

  return {
    contexts,
    ctxLoaded,
    openContext,
    onCtxList: useCallback(() => { send({ t: 'ctx-list' }); }, [send]),
    onCtxOpen: useCallback((id: string) => { send({ t: 'ctx-open', id }); }, [send]),
    onCtxClose: useCallback(() => setOpenContext(null), []),
    onMsg,
  };
}
