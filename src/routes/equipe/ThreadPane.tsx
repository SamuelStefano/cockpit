import type { TeamBot } from '../../../shared/protocol';
import type { EquipeProps } from './equipe-props';
import type { BotView } from './team-view';
import { BotThread } from './BotThread';
import { PeerThread } from './PeerThread';

interface ThreadPaneProps {
  view: BotView;
  peer: TeamBot | null;
  byId: Map<string, TeamBot>;
  p: Pick<EquipeProps, 'chatProps' | 'bots' | 'teamMessages' | 'botFileData' | 'onBotFileGet'>;
  onOpenPeer: (id: string) => void;
  onClosePeer: () => void;
  onProfile?: () => void;
  profileOpen?: boolean;
}

export function ThreadPane({ view, peer, byId, p, onOpenPeer, onClosePeer, onProfile, profileOpen }: ThreadPaneProps) {
  if (peer) return <PeerThread a={view.bot} b={peer} log={p.teamMessages} byId={byId} onBack={onClosePeer} onQuote={p.chatProps.onQuote} />;
  return <BotThread view={view} chatProps={p.chatProps} bots={p.bots} log={p.teamMessages} files={p} onOpenPeer={onOpenPeer} onProfile={onProfile} profileOpen={profileOpen} />;
}
