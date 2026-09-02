import { useEffect } from 'react';
import type { Session } from '../data/types';

interface Args {
  route: string;
  chatId: string;
  navChat: (id: string, replace?: boolean) => void;
  activeId: string;
  setActiveId: (id: string) => void;
  sessions: Session[];
  archived: Session[];
}

// Mantém URL (/c/<id>) e sessão ativa em sincronia nos dois sentidos, sem
// ping-pong: cada efeito depende só da SUA origem de mudança. O de cima reage
// à URL (voltar/avançar, link colado); o de baixo reage ao activeId derivado
// (rascunho new-xxx que virou uuid, restore pós-F5) e só faz replace — o push
// que cria entrada no history fica no clique do usuário (selectSession no App).
export function useChatUrl({ route, chatId, navChat, activeId, setActiveId, sessions, archived }: Args) {
  useEffect(() => {
    if (!chatId || !activeId || chatId === activeId) return;
    // Id que o servidor não conhece (apagado, link velho): fica na sessão atual e
    // o efeito de baixo corrige a URL em vez de abrir um chat vazio.
    const known = sessions.some((s) => s.id === chatId) || archived.some((s) => s.id === chatId);
    if (known) setActiveId(chatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, sessions, archived]);

  useEffect(() => {
    if (route !== '/' || !activeId || activeId.startsWith('new-')) return;
    navChat(activeId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, route]);
}
