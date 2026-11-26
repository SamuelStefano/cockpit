import type { ReactNode } from 'react';
import type { Session } from '../../../data/types';
import type { BotView } from '../../../routes/equipe/team-view';
import type { AgentTab, Route } from '../../../useRoute';
import type { ConnState } from '../../primitives';
import type { BitState } from '../../bit/bit-state';
import type { NavRole } from '../nav-routes';
import type { AccountProps } from '../sidebar/SidebarFooter';
import { AgentSpaceSide } from './AgentSpaceSide';
import { AllSpaceSide } from './AllSpaceSide';
import { SpacesRail } from './SpacesRail';
import { useDesktopShell } from './useDesktopShell';

export interface DesktopShellProps {
  route: Route;
  nav: (to: Route) => void;
  navAgent: (id: string, tab?: AgentTab) => void;
  role: NavRole;
  navCounts?: Partial<Record<Route, number>>;
  bitState: BitState;
  conn: ConnState;
  account: AccountProps;
  onNew: () => void;
  onPalette: () => void;
  agents: BotView[];
  activeAgentId: string | null;
  onOpenAgent: (id: string) => void;
  onNewAgent?: () => void;
  onRotateAgent?: (botId: string) => void;
  // All conversations: the memoized SessionsPanel, built by the caller with stable props.
  sessionsPanel: ReactNode;
  // Plain chats (no bot threads): the running tiles of the collapsed rail.
  chatSessions: Session[];
  sessions: Session[];
  activeSessionId: string;
  running?: Set<string>;
  onSelectSession: (id: string) => void;
}

export function DesktopShell(p: DesktopShellProps) {
  const s = useDesktopShell(p.agents, p.activeAgentId, p.onOpenAgent, p.nav);
  return (
    <>
      <SpacesRail
        bitState={p.bitState} views={p.agents} selectedAgentId={s.space.agentId} onAll={s.space.selectAll} onAgent={s.onAgent}
        onNewAgent={p.onNewAgent} onAddBox={s.onAddBox}
        collapsed={s.collapsed} onExpand={s.toggle} onNew={p.onNew}
        chatSessions={p.chatSessions} chatRunning={p.running} activeChatId={p.activeSessionId} onSelectChat={p.onSelectSession}
        role={p.role} route={p.route} nav={p.nav} navCounts={p.navCounts} pendingCount={s.pendingCount} onPalette={p.onPalette} account={p.account} conn={p.conn}
      />
      {!s.collapsed && (
        <aside aria-label="Navegação principal" className="relative z-20 flex h-full w-72 shrink-0 flex-col border-r border-(--border) bg-(--bg-deep)">
          {s.view ? (
            <AgentSpaceSide
              view={s.view} chief={s.chief} sessions={p.sessions} activeSessionId={p.activeSessionId} running={p.running}
              onOpenThread={p.onOpenAgent} onSelectSession={p.onSelectSession} onRotate={p.onRotateAgent}
              onWorkspace={(id) => p.navAgent(id, 'arquivos')} onProfile={(id) => p.navAgent(id)} onCollapse={s.toggle}
            />
          ) : (
            <AllSpaceSide sessions={p.sessionsPanel} onNew={p.onNew} onCollapse={s.toggle} onManageAgents={() => p.nav('/agentes')} />
          )}
        </aside>
      )}
    </>
  );
}
