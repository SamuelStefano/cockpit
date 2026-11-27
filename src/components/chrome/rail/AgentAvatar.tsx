import type { BotView } from '../../../routes/equipe/team-view';
import { Avatar } from '../../primitives';
import { Mascot } from '../../team/Mascot';
import { railStatus, railTone } from './rail-order';

interface AgentAvatarProps {
  view: BotView;
  size?: number;
  selected?: boolean;
}

export function AgentAvatar({ view, size = 44, selected = false }: AgentAvatarProps) {
  const { bot, state } = view;
  return (
    <Avatar
      name={bot.name} size={size} tone={railTone(bot.id)} status={railStatus(view)}
      glyph={<Mascot mascot={bot.mascot} state={state} size={Math.round(size * 0.78)} />}
      className={selected ? 'ring-2 ring-(--accent) ring-offset-2 ring-offset-(--bg-deep)' : ''}
    />
  );
}
