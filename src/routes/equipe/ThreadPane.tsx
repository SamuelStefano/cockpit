import type { TeamBot } from '../../../shared/protocol';
import type { EquipeProps } from './equipe-props';
import type { BotView } from './team-view';
import { BotThread } from './BotThread';
import { PeerThread } from './PeerThread';

interface ThreadPaneProps {
  view: BotView;
  peer: TeamBot | null;
  byId: Map<string, TeamBot>;
  p: Pick<EquipeProps, 'chatProps' | 'bots' | 'teamMessages'>;
  onOpenPeer: (id: string) => void;
  onClosePeer: () => void;
  onBack?: () => void;
  onProfile?: () => void;
}

export function ThreadPane({ view, peer, byId, p, onOpenPeer, onClosePeer, onBack, onProfile }: ThreadPaneProps) {
  if (peer) return <PeerThread a={view.bot} b={peer} log={p.teamMessages} byId={byId} onBack={onClosePeer} />;
  return <BotThread view={view} chatProps={p.chatProps} bots={p.bots} log={p.teamMessages} onOpenPeer={onOpenPeer} onBack={onBack} onProfile={onProfile} />;
}
