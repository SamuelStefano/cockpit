import { useCallback, useEffect, useMemo } from 'react';
import { FOCUS_SESSION_SEARCH } from '../../sessions/useSessionsPanel';
import type { BotView } from '../../../routes/equipe/team-view';
import type { Route } from '../../../useRoute';
import { pendingRequests } from '../sidebar/mobile-pending';
import { useSidebarCollapsed } from '../sidebar/useSidebarCollapsed';
import { isChief } from './agent-space';
import { useActiveSpace } from './useActiveSpace';

export function useDesktopShell(views: BotView[], activeAgentId: string | null, openAgent: (id: string) => void, nav: (to: Route) => void) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const ids = useMemo(() => views.map((v) => v.bot.id), [views]);
  const space = useActiveSpace(activeAgentId, ids);
  const { selectAgent, selectAll } = space;
  const inAgentSpace = space.agentId !== null;
  useEffect(() => {
    if (!inAgentSpace) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== '/') return;
      e.preventDefault();
      selectAll();
      setTimeout(() => window.dispatchEvent(new Event(FOCUS_SESSION_SEARCH)), 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inAgentSpace, selectAll]);
  const onAgent = useCallback((id: string) => { selectAgent(id); openAgent(id); }, [selectAgent, openAgent]);
  const view = space.agentId ? views.find((v) => v.bot.id === space.agentId) ?? null : null;
  const chief = useMemo(() => !!view && isChief(view.bot, views.map((v) => v.bot)), [view, views]);
  const pendingCount = useMemo(() => pendingRequests(views), [views]);
  const onAddBox = useCallback(() => nav('/configuracoes/maquinas'), [nav]);
  return { collapsed, toggle, space, onAgent, onAddBox, view, chief, pendingCount };
}
