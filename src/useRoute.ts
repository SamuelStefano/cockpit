import { useState, useEffect, useCallback } from 'react';

// Router minúsculo (sem dep): só troca a VIEW principal. useCockpit fica ACIMA
// deste switch no App, então o WebSocket/terminais nunca desmontam ao navegar.
export type Route = '/' | '/equipe/memoria' | '/skills' | '/pontos' | '/equipe/rotinas' | '/configuracoes' | '/configuracoes/uso' | '/configuracoes/pessoas' | '/configuracoes/maquina' | '/configuracoes/avancado' | '/graph' | '/canvas' | '/sala' | '/conexoes' | '/docs' | '/ds' | '/onboarding' | '/agentes' | '/base' | '/arcade';

const ROUTES: Route[] = ['/', '/equipe/memoria', '/skills', '/pontos', '/equipe/rotinas', '/configuracoes', '/configuracoes/uso', '/configuracoes/pessoas', '/configuracoes/maquina', '/configuracoes/avancado', '/graph', '/canvas', '/sala', '/conexoes', '/docs', '/ds', '/onboarding', '/agentes', '/base', '/arcade'];

// Old URLs (bookmarks, deep links) keep working; the retired screens fall back to chat.
const LEGACY: Record<string, string> = { '/notas': '/', '/play': '/', '/harness': '/', '/equipe': '/', '/contextos': '/equipe/memoria', '/crons': '/equipe/rotinas', '/uso': '/configuracoes/uso' };

// /painel is gone: its tabs moved to Configurações (Máquina, Pessoas) and Conexões.
const PAINEL_TO: Record<string, string> = { overview: '/configuracoes/maquina', host: '/configuracoes/maquina', accounts: '/configuracoes/pessoas', mcps: '/conexoes#ferramentas', agents: '/conexoes#provedores', models: '/conexoes#provedores' };

export function legacyRedirect(pathname: string, hash: string): string | null {
  if (pathname === '/painel' || pathname === '/admin') return PAINEL_TO[decodeURIComponent(hash.replace(/^#/, ''))] ?? '/configuracoes/maquina';
  return LEGACY[pathname] ?? null;
}

function redirectLegacy(): void {
  const to = legacyRedirect(location.pathname, location.hash);
  if (to) history.replaceState(null, '', to);
}

// Chat aberto tem URL própria (/c/<sessionId>): link salvável, F5 sem perder a
// conversa, duas abas em chats diferentes. A VIEW continua sendo '/', então o id
// só alimenta a sessão ativa — nada remonta ao trocar de chat.
const CHAT = '/c/';
// The GitHub App "Setup URL" lands here; it renders Conexões, which consumes the query.
const GITHUB_RETURN = '/conexoes/github';

export type AgentTab = 'perfil' | 'rotinas' | 'arquivos' | 'computador';
const AGENT_TABS: readonly AgentTab[] = ['perfil', 'rotinas', 'arquivos', 'computador'];
const AGENTS = '/agentes/';
const SKILLS = '/skills/';

export interface RouteState { route: Route; chatId: string; agentId: string; agentTab: AgentTab; skillId: string }

export const chatPath = (id: string) => CHAT + encodeURIComponent(id);
export const skillPath = (id: string) => (id ? SKILLS + encodeURIComponent(id) : '/skills');

export function agentPath(id: string, tab: AgentTab = 'perfil'): string {
  if (!id) return '/';
  return AGENTS + encodeURIComponent(id) + (tab === 'perfil' ? '' : `?aba=${tab}`);
}

const plain = (route: Route, chatId = '', skillId = ''): RouteState => ({ route, chatId, agentId: '', agentTab: 'perfil', skillId });

function current(): RouteState {
  redirectLegacy();
  const p = location.pathname;
  if (p === GITHUB_RETURN) return plain('/conexoes');
  if (p.startsWith(CHAT)) {
    const id = decodeURIComponent(p.slice(CHAT.length));
    if (id) return plain('/', id);
  }
  if (p.startsWith(SKILLS)) return plain('/skills', '', decodeURIComponent(p.slice(SKILLS.length).split('/')[0]));
  if (p === '/agentes') {
    history.replaceState(null, '', '/');
    return plain('/');
  }
  if (p.startsWith(AGENTS)) {
    const id = decodeURIComponent(p.slice(AGENTS.length).split('/')[0]);
    if (id) {
      const aba = new URLSearchParams(location.search).get('aba') as AgentTab | null;
      return { ...plain('/agentes'), agentId: id, agentTab: aba && AGENT_TABS.includes(aba) ? aba : 'perfil' };
    }
  }
  return plain(ROUTES.includes(p as Route) ? (p as Route) : '/');
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
    setState(plain(to));
  }, []);
  // replace=true pros ajustes DERIVADOS (rascunho new-xxx que virou sessionId
  // real, F5 restaurando a última sessão): corrige a URL sem empilhar history.
  const navChat = useCallback((id: string, replace = false) => {
    const path = chatPath(id);
    if (location.pathname === path) return;
    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
    setState(plain('/', id));
  }, []);
  const navAgent = useCallback((id: string, tab: AgentTab = 'perfil', replace = false) => {
    const path = agentPath(id, tab);
    if (location.pathname + location.search !== path) {
      if (replace) history.replaceState(null, '', path);
      else history.pushState(null, '', path);
    }
    if (!id) { setState(plain('/')); return; }
    setState({ ...plain('/agentes'), agentId: id, agentTab: tab });
  }, []);
  const navSkill = useCallback((id: string) => {
    const path = skillPath(id);
    if (location.pathname !== path) history.pushState(null, '', path);
    setState(plain('/skills', '', id));
  }, []);
  return { route: state.route, chatId: state.chatId, agentId: state.agentId, agentTab: state.agentTab, skillId: state.skillId, nav, navChat, navAgent, navSkill };
}
