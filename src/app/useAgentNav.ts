import { useCallback, useEffect, useState } from 'react';
import type { TeamBot } from '../../shared/protocol';
import type { BotFormTarget } from '../routes/equipe/equipe-props';
import type { BotView } from '../routes/equipe/team-view';
import type { Route } from '../useRoute';
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
  form: BotFormTarget;
  openNew: () => void;
  openEdit: () => void;
  closeForm: () => void;
  profileOpen: boolean;
  toggleProfile: () => void;
  closeProfile: () => void;
}

// Agents live in the same shell as every chat: opening one makes its thread the
// open chat. `/equipe` is the org chart page; opening a node lands here.
export function useAgentNav(t: AgentNavInput, route: Route, nav: (to: Route) => void): AgentNav {
  const { bots, activeId, connected, onTeamGet, onOpenBot } = t;
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

  const [form, setForm] = useState<BotFormTarget>(null);
  const [profile, setProfile] = useState(false);
  const activeBot = active?.bot;
  return {
    views, active, open, form,
    openNew: useCallback(() => setForm({ mode: 'new' }), []),
    openEdit: useCallback(() => { if (activeBot) setForm({ mode: 'edit', bot: activeBot }); }, [activeBot]),
    closeForm: useCallback(() => setForm(null), []),
    profileOpen: profile && !!active,
    toggleProfile: useCallback(() => setProfile((o) => !o), []),
    closeProfile: useCallback(() => setProfile(false), []),
  };
}
