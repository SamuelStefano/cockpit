import { useState, useEffect, useCallback } from 'react';

// Router minúsculo (sem dep): só troca a VIEW principal. useCockpit fica ACIMA
// deste switch no App, então o WebSocket/terminais nunca desmontam ao navegar.
export type Route = '/' | '/contextos' | '/skills' | '/notas' | '/pontos' | '/crons' | '/uso' | '/graph' | '/harness' | '/admin' | '/docs' | '/ds' | '/play';

const ROUTES: Route[] = ['/', '/contextos', '/skills', '/notas', '/pontos', '/crons', '/uso', '/graph', '/harness', '/admin', '/docs', '/ds', '/play'];

// Chat aberto tem URL própria (/c/<sessionId>): link salvável, F5 sem perder a
// conversa, duas abas em chats diferentes. A VIEW continua sendo '/', então o id
// só alimenta a sessão ativa — nada remonta ao trocar de chat.
const CHAT = '/c/';

export interface RouteState { route: Route; chatId: string }

export const chatPath = (id: string) => CHAT + encodeURIComponent(id);

function current(): RouteState {
  const p = location.pathname;
  if (p.startsWith(CHAT)) {
    const id = decodeURIComponent(p.slice(CHAT.length));
    if (id) return { route: '/', chatId: id };
  }
  return { route: ROUTES.includes(p as Route) ? (p as Route) : '/', chatId: '' };
}

export function useRoute() {
  const [state, setState] = useState<RouteState>(current);
  useEffect(() => {
    const onPop = () => setState(current());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const nav = useCallback((to: Route) => {
    if (location.pathname === to) return;
    history.pushState(null, '', to);
    setState({ route: to, chatId: '' });
  }, []);
  // replace=true pros ajustes DERIVADOS (rascunho new-xxx que virou sessionId
  // real, F5 restaurando a última sessão): corrige a URL sem empilhar history.
  const navChat = useCallback((id: string, replace = false) => {
    const path = chatPath(id);
    if (location.pathname === path) return;
    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
    setState({ route: '/', chatId: id });
  }, []);
  return { route: state.route, chatId: state.chatId, nav, navChat };
}
