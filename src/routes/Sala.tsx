import { useMemo, useState } from 'react';
import type { BotComputer, SysStats, TeamBot } from '../../shared/protocol';
import type { SessionPeek } from '../../shared/canvas';
import type { Session } from '../data/types';
import type { BotComputerState } from '../cockpit/useBotComputer';
import { Badge, EmptyState, RouteHeader } from '../components/primitives';
import { SalaDetail } from './SalaDetail';
import { SalaFeed } from './SalaFeed';
import { SalaHud } from './SalaHud';
import { SalaMap } from './SalaMap';
import { SalaQuests } from './SalaQuests';
import { buildSala } from './sala/model';
import { useSalaPoll } from './sala/useSalaPoll';

interface Props {
  connected: boolean;
  bots: TeamBot[];
  sessions: Session[];
  running: Set<string>;
  stats: SysStats | null;
  computers: Record<string, BotComputerState>;
  peeks: Record<string, SessionPeek | null>;
  onComputer: (botId: string) => void;
  onPeek: (sessionId: string) => void;
  onOpenSession: (id: string) => void;
}

export function Sala(p: Props) {
  const [picked, setPicked] = useState('');
  const map = useMemo(() => buildSala({
    bots: p.bots.map((b) => ({
      id: b.id, name: b.name, label: b.label, color: b.mascot.color,
      parentId: b.parentId, primary: b.primary, sessionId: b.sessionId,
    })),
    sessions: p.sessions.map((s) => ({
      id: s.id, title: s.title, snippet: s.snippet, mtime: s.mtime, waiting: s.waiting, lastTurnOk: s.lastTurnOk,
    })),
    running: p.running,
    now: Date.now(),
  }), [p.bots, p.sessions, p.running]);
  const selected = map.nodes.find((n) => n.id === picked) ?? map.nodes[0];
  const hotBots = map.nodes.filter((n) => n.botId && (n.pulse === 'working' || n.id === selected?.id)).map((n) => n.botId!);
  const hotSessions = map.nodes.filter((n) => n.sessionId && (n.pulse === 'working' || n.id === selected?.id)).map((n) => n.sessionId!);
  useSalaPoll({
    connected: p.connected,
    botIds: hotBots,
    sessionIds: hotSessions,
    onComputer: p.onComputer,
    onPeek: p.onPeek,
  });
  const comp = selected?.botId ? p.computers[selected.botId] : undefined;
  const computer: BotComputer | undefined = comp?.status === 'ok' ? comp.computer : undefined;
  const lines = map.nodes.flatMap((n) => {
    if (!n.botId) return [];
    const row = p.computers[n.botId];
    const text = row?.status === 'ok' ? row.computer.preview.at(-1)?.trim() : '';
    return text ? [{ who: n.title, text }] : [];
  }).slice(0, 4);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950 text-neutral-100">
      <RouteHeader
        variant="bar"
        title="sala"
        icon="zap"
        badge={<Badge tone="orange" dot>ao vivo</Badge>}
        subtitle="equipe, chats e o computador"
        actions={<SalaHud working={map.working} waiting={map.waiting} bots={p.bots.length} stats={p.stats} />}
      />
      {!p.connected ? (
        <EmptyState icon="circle" title="Desconectado" description="Reconecte para ver a sala." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SalaQuests />
            <div className="min-h-0 flex-1 overflow-auto px-2 py-3">
              <SalaMap nodes={map.nodes} edges={map.edges} selectedId={selected?.id ?? ''} onSelect={setPicked} />
            </div>
            <SalaFeed lines={lines} />
          </div>
          <SalaDetail
            node={selected}
            computer={computer}
            computerError={comp?.status === 'error' ? comp.error : undefined}
            peek={selected?.sessionId ? p.peeks[selected.sessionId] : undefined}
            onOpen={p.onOpenSession}
          />
        </div>
      )}
    </div>
  );
}
