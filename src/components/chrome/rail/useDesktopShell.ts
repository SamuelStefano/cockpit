import { useCallback, useMemo } from 'react';
import type { BotView } from '../../../routes/equipe/team-view';
import type { Route } from '../../../useRoute';
import { useSidebarCollapsed } from '../sidebar/useSidebarCollapsed';
import { isChief } from './agent-space';
import { useActiveSpace } from './useActiveSpace';

export function useDesktopShell(views: BotView[], activeAgentId: string | null, openAgent: (id: string) => void, nav: (to: Route) => void) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const ids = useMemo(() => views.map((v) => v.bot.id), [views]);
  const space = useActiveSpace(activeAgentId, ids);
  const { selectAgent } = space;
  const onAgent = useCallback((id: string) => { selectAgent(id); openAgent(id); }, [selectAgent, openAgent]);
  const view = space.agentId ? views.find((v) => v.bot.id === space.agentId) ?? null : null;
  const chief = useMemo(() => !!view && isChief(view.bot, views.map((v) => v.bot)), [view, views]);
  const pendingCount = useMemo(() => views.filter((v) => v.pending).length, [views]);
  const onAddBox = useCallback(() => nav('/configuracoes/maquinas'), [nav]);
  return { collapsed, toggle, space, onAgent, onAddBox, view, chief, pendingCount };
}
