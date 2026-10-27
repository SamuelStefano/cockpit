import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadPref, savePref } from '../lib/persist';
import { botView, lastTrafficByBot, orderBots, pendingByBot, type BotView } from '../routes/equipe/team-view';
import { botName, type TeamMessage } from '../../shared/team-messages';
import type { TeamBot, TeamPendingQuestion } from '../../shared/protocol';
import type { Session } from '../data/types';
import type { Phase } from '../components/chat/useChatPanel';

const NOW_TICK_MS = 30_000;

export interface AgentViewsInput {
  bots: TeamBot[];
  sessions: Session[];
  running: Set<string>;
  activeId: string;
  phase: Phase;
  interrupted: Record<string, string>;
  runStart: Record<string, number>;
  pendingQuestions: TeamPendingQuestion[];
  teamMessages: TeamMessage[];
}

// One view per bot (primary first) with its mascot state, preview and unread
// flag; opening a bot's thread marks it seen.
export function useAgentViews(t: AgentViewsInput, activeAgentId: string | null): BotView[] {
  const [seen, setSeen] = useState<Record<string, number>>(() => loadPref<Record<string, number>>('equipe.seen', {}));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS); return () => clearInterval(id); }, []);

  const { bots, sessions, running, activeId, phase, interrupted, runStart, pendingQuestions, teamMessages } = t;
  const lastTraffic = useMemo(() => lastTrafficByBot(teamMessages), [teamMessages]);
  const pending = useMemo(() => pendingByBot(pendingQuestions), [pendingQuestions]);
  const nameOf = useCallback((id: string) => botName(bots, id), [bots]);
  const views = useMemo(() => {
    const ctx = { sessions, running, activeId, phase, interrupted, runStart, seen, selectedId: activeAgentId, now, lastTraffic, nameOf, pending };
    return orderBots(bots).map((b) => botView(b, ctx));
  }, [bots, sessions, running, activeId, phase, interrupted, runStart, seen, activeAgentId, now, lastTraffic, nameOf, pending]);

  const activeKey = views.find((v) => v.bot.id === activeAgentId)?.key;
  const activeMtime = sessions.find((s) => s.id === activeKey)?.mtime;
  useEffect(() => {
    if (!activeAgentId || activeMtime === undefined || (seen[activeAgentId] ?? 0) >= activeMtime) return;
    const next = { ...seen, [activeAgentId]: activeMtime };
    setSeen(next);
    savePref('equipe.seen', next);
  }, [activeAgentId, activeMtime, seen]);

  return views;
}
