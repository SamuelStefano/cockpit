import { useEffect, useMemo, useState } from 'react';
import { loadPref, savePref } from '../../lib/persist';
import { botView, orderBots } from './team-view';
import type { BotFormTarget, EquipePane, EquipeProps } from './equipe-props';

const NOW_TICK_MS = 30_000;

export function useEquipe(p: EquipeProps) {
  const { connected, bots, onTeamGet, onOpenBot } = p;
  useEffect(() => { if (connected) onTeamGet(); }, [connected, onTeamGet]);

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

  const ctx = { sessions: p.sessions, running: p.running, activeId: p.activeId, phase: p.phase, interrupted: p.interrupted, runStart: p.runStart, seen, selectedId: currentId, now };
  const views = ordered.map((b) => botView(b, ctx));
  const selectedView = views.find((v) => v.bot.id === currentId) ?? null;

  const selectedMtime = p.sessions.find((s) => s.id === selectedView?.key)?.mtime;
  useEffect(() => {
    if (!currentId || selectedMtime === undefined || (seen[currentId] ?? 0) >= selectedMtime) return;
    const next = { ...seen, [currentId]: selectedMtime };
    setSeen(next);
    savePref('equipe.seen', next);
  }, [currentId, selectedMtime, seen]);

  const select = (id: string) => {
    setSelectedId(id);
    savePref('equipe.selected', id);
    setPane('thread');
  };

  return {
    views, selectedView, pane, setPane, select,
    form, openNew: () => setForm({ mode: 'new' }), openEdit: () => selected && setForm({ mode: 'edit', bot: selected }), closeForm: () => setForm(null),
  };
}
