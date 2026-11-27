import { AGENT_MEETINGS, STORE_ROUTE, type Route } from '../../useRoute';
import { roleRedirect, type NavRole } from '../../components/chrome/nav-routes';
import type { IconName } from '../../components/primitives';

export interface ExploreItem {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  path: string;
  // The route whose access rule this item follows; some targets are not routes of their own.
  gate: Route;
}

export const EXPLORE_ITEMS: ExploreItem[] = [
  { id: 'mundo', title: 'Mundo', description: 'A vila onde os agentes aparecem trabalhando.', icon: 'globe', path: '/equipe/mundo', gate: '/equipe/mundo' },
  { id: 'base', title: 'Base 3D', description: 'O escritório em 3D, com câmera livre.', icon: 'layers', path: '/base', gate: '/base' },
  { id: 'graph', title: 'Graph do código', description: 'Arquivos, funções e dependências.', icon: 'code', path: '/graph', gate: '/graph' },
  { id: 'reunioes', title: 'Reuniões', description: 'Junte agentes para decidir algo juntos.', icon: 'users', path: `/agentes/${AGENT_MEETINGS}`, gate: STORE_ROUTE },
  { id: 'loja', title: 'Loja de agentes', description: 'Agentes prontos para contratar.', icon: 'tag', path: STORE_ROUTE, gate: STORE_ROUTE },
  { id: 'arcade', title: 'Arcade', description: 'Jogos rápidos enquanto os agentes trabalham.', icon: 'zap', path: '/arcade', gate: '/explorar' },
  { id: 'ds', title: 'Design system', description: 'Tokens e componentes do Deck.', icon: 'grip', path: '/ds', gate: '/explorar' },
  { id: 'onboarding', title: 'Onboarding', description: 'Os três passos do primeiro acesso.', icon: 'book', path: '/onboarding', gate: '/explorar' },
];

export function exploreItemsFor(role: NavRole): ExploreItem[] {
  return EXPLORE_ITEMS.filter((i) => roleRedirect(role, i.gate) === null);
}
