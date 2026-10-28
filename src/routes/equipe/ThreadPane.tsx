import type { EquipeProps } from './equipe-props';
import type { BotView } from './team-view';
import { BotThread } from './BotThread';

interface ThreadPaneProps {
  view: BotView;
  p: Pick<EquipeProps, 'chatProps' | 'bots' | 'teamMessages' | 'botFileData' | 'onBotFileGet' | 'teamPaused' | 'onTeamPauseSet' | 'isAdmin' | 'views' | 'crons'>;
  onProfile?: () => void;
  profileOpen?: boolean;
}

export function ThreadPane({ view, p, onProfile, profileOpen }: ThreadPaneProps) {
  const pause = p.isAdmin && p.bots.length > 1 ? { paused: p.teamPaused, onSet: p.onTeamPauseSet } : undefined;
  return <BotThread view={view} chatProps={p.chatProps} bots={p.bots} log={p.teamMessages} files={p} onProfile={onProfile} profileOpen={profileOpen} pause={pause} views={p.views} crons={p.crons} />;
}
