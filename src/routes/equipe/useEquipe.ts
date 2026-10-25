import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadPref, savePref } from '../../lib/persist';
import { botView, lastTrafficByBot, orderBots } from './team-view';
import { botName } from '../../../shared/team-messages';
import type { BotFormTarget, EquipePane, EquipeProps } from './equipe-props';

const NOW_TICK_MS = 30_000;

export function useEquipe(p: EquipeProps) {
  const { connected, bots, onTeamGet, onOpenBot, onTeamMessagesGet, teamMessages } = p;
  useEffect(() => { if (connected) { onTeamGet(); onTeamMessagesGet(); } }, [connected, onTeamGet, onTeamMessagesGet]);

  const [selectedId, setSelectedId] = useState<string | null>(() => loadPref<string | null>('equipe.selected', null));
  const [pane, setPane] = useState<EquipePane>('roster');
  const [form, setForm] = useState<BotFormTarget>(null);
  const [seen, setSeen] = useState<Record<string, number>>(() => loadPref<Record<string, number>>('equipe.seen', {}));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), NOW_TICK_MS); return () => clearInterval(t); }, []);

  const ordered = useMemo(() => orderBots(bots), [bots]);
  const currentId = selectedId && bots.some((b) => b.id === selectedId) ? selectedId : ordered[0]?.id ?? null;
  const selected = bots.find((b) => b.id === currentId) ?? null;

  useEffect(() => {
    if (selected) onOpenBot(selected.id, selected.sessionId, selected.name);
    // Re-open only when the bot or its bound thread changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.sessionId]);

  const lastTraffic = useMemo(() => lastTrafficByBot(teamMessages), [teamMessages]);
  const nameOf = useCallback((id: string) => botName(bots, id), [bots]);
  const ctx = { sessions: p.sessions, running: p.running, activeId: p.activeId, phase: p.phase, interrupted: p.interrupted, runStart: p.runStart, seen, selectedId: currentId, now, lastTraffic, nameOf };
  const views = ordered.map((b) => botView(b, ctx));
  const selectedView = views.find((v) => v.bot.id === currentId) ?? null;

  const selectedMtime = p.sessions.find((s) => s.id === selectedView?.key)?.mtime;
  useEffect(() => {
    if (!currentId || selectedMtime === undefined || (seen[currentId] ?? 0) >= selectedMtime) return;
    const next = { ...seen, [currentId]: selectedMtime };
    setSeen(next);
    savePref('equipe.seen', next);
  }, [currentId, selectedMtime, seen]);

  const byId = useMemo(() => new Map(bots.map((b) => [b.id, b])), [bots]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const peer = peerId && peerId !== currentId ? bots.find((b) => b.id === peerId) ?? null : null;
  const openPeer = useCallback((id: string) => {
    if (currentId) onTeamMessagesGet({ botId: currentId, peer: id });
    setPeerId(id);
    setPane('thread');
  }, [currentId, onTeamMessagesGet]);
  const closePeer = useCallback(() => setPeerId(null), []);

  const select = (id: string) => {
    setSelectedId(id);
    savePref('equipe.selected', id);
    setPeerId(null);
    setPane('thread');
  };

  return {
    views, selectedView, pane, setPane, select, peer, openPeer, closePeer, byId,
    form, openNew: () => setForm({ mode: 'new' }), openEdit: () => selected && setForm({ mode: 'edit', bot: selected }), closeForm: () => setForm(null),
  };
}
