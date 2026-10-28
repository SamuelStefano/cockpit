import { useCallback, useEffect } from 'react';
import type { TeamBot } from '../../shared/protocol';
import type { BotView } from '../routes/equipe/team-view';
import type { AgentTab, Route } from '../useRoute';
import { agentIdForSession } from './agent-session';
import { useAgentViews, type AgentViewsInput } from './useAgentViews';

export interface AgentNavInput extends AgentViewsInput {
  teamLoaded: boolean;
  connected: boolean;
  onTeamGet: () => void;
  onOpenBot: (botId: string, sessionId: string | undefined, title: string) => void;
}

export interface AgentNav {
  views: BotView[];
  active: BotView | null;
  open: (id: string) => void;
  openNew: () => void;
  openEdit: () => void;
  profileOpen: boolean;
  toggleProfile: () => void;
  closeProfile: () => void;
}

// Agents live in the same shell as every chat: opening one makes its thread the
// open chat. `/equipe` is only a deep link that lands on the primary agent.
export function useAgentNav(t: AgentNavInput, route: Route, nav: (to: Route) => void, navAgent: (id: string, tab?: AgentTab) => void): AgentNav {
  const { bots, activeId, teamLoaded, connected, onTeamGet, onOpenBot } = t;
  useEffect(() => { if (connected) onTeamGet(); }, [connected, onTeamGet]);

  const activeAgentId = agentIdForSession(bots, activeId);
  const views = useAgentViews(t, activeAgentId);
  const active = views.find((v) => v.bot.id === activeAgentId) ?? null;

  // The URL goes to the bare root first: an old /c/<id> would otherwise pull the
  // active chat back (useChatUrl), and the draft key of a new thread has no URL.
  const open = useCallback((id: string) => {
    const bot = bots.find((b: TeamBot) => b.id === id);
    if (!bot) return;
    nav('/');
    onOpenBot(bot.id, bot.sessionId, bot.name);
  }, [bots, nav, onOpenBot]);

  const primaryId = views[0]?.bot.id;
  useEffect(() => {
    if (route === '/equipe' && teamLoaded && !activeAgentId && primaryId) open(primaryId);
  }, [route, teamLoaded, activeAgentId, primaryId, open]);

  const activeBot = active?.bot;
  return {
    views, active, open,
    openNew: useCallback(() => navAgent('novo'), [navAgent]),
    openEdit: useCallback(() => { if (activeBot) navAgent(activeBot.id); }, [activeBot, navAgent]),
    profileOpen: false,
    toggleProfile: useCallback(() => { if (activeBot) navAgent(activeBot.id); }, [activeBot, navAgent]),
    closeProfile: useCallback(() => {}, []),
  };
}
