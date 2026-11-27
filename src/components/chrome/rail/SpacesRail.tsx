import { memo } from 'react';
import type { Session } from '../../../data/types';
import type { BotView } from '../../../routes/equipe/team-view';
import { Icon, IconButton } from '../../primitives';
import type { BitState } from '../../bit/bit-state';
import { AgentAvatar } from './AgentAvatar';
import { AgentOverflow } from './AgentOverflow';
import { BoxChip } from './BoxChip';
import { RailChats } from '../sidebar/RailChats';
import { RailBottom, type RailBottomProps } from './RailBottom';
import { RailLogo } from './RailLogo';
import { railAgents } from './rail-order';
import { SpaceButton } from './SpaceButton';
import { SpaceTile } from './SpaceTile';

export interface SpacesRailProps extends RailBottomProps {
  bitState: BitState;
  views: BotView[];
  selectedAgentId: string | null;
  onAll: () => void;
  onAgent: (id: string) => void;
  onNewAgent?: () => void;
  onAddBox: () => void;
  // Side collapsed: the rail also carries expand, new chat and the running chats.
  collapsed: boolean;
  onExpand: () => void;
  onNew: () => void;
  chatSessions: Session[];
  chatRunning?: Set<string>;
  activeChatId: string;
  onSelectChat: (id: string) => void;
}

function SpacesRailImpl({ bitState, views, selectedAgentId, onAll, onAgent, onNewAgent, onAddBox, collapsed, onExpand, onNew, chatSessions, chatRunning, activeChatId, onSelectChat, ...bottom }: SpacesRailProps) {
  const { shown, hidden } = railAgents(views, selectedAgentId);
  return (
    <nav aria-label="Espaços" className="relative z-30 flex h-full w-20 shrink-0 flex-col items-center border-r border-(--border) bg-neutral-950 pb-3 pt-3.5">
      <RailLogo bitState={bitState} onHome={() => bottom.nav('/')} />
      <BoxChip onAdd={onAddBox} />
      {collapsed && (
        <div className="flex shrink-0 flex-col items-center gap-1 pb-1">
          <IconButton icon="panelLeft" label="Expandir barra lateral" side="right" aria-expanded={false} onClick={onExpand} />
          <IconButton icon="squarePen" label="Nova conversa" side="right" onClick={onNew} />
        </div>
      )}
      <div className="scroll-thin flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden pt-1">
        <SpaceButton label="Todas as conversas" selected={!selectedAgentId} onClick={onAll}>
          <SpaceTile selected={!selectedAgentId}><Icon name="message" size={18} /></SpaceTile>
        </SpaceButton>
        {shown.map((v) => (
          <SpaceButton key={v.bot.id} label={v.bot.name} selected={v.bot.id === selectedAgentId} onClick={() => onAgent(v.bot.id)}>
            <AgentAvatar view={v} selected={v.bot.id === selectedAgentId} />
          </SpaceButton>
        ))}
        {hidden > 0 && <AgentOverflow hidden={hidden} views={views} selectedId={selectedAgentId} onOpen={onAgent} />}
        {onNewAgent && (
          <SpaceButton label="Novo agente" onClick={onNewAgent}>
            <SpaceTile><Icon name="plus" size={18} /></SpaceTile>
          </SpaceButton>
        )}
        {collapsed && <RailChats sessions={chatSessions} running={chatRunning} activeId={activeChatId} onSelect={onSelectChat} />}
      </div>
      <RailBottom {...bottom} />
    </nav>
  );
}

export const SpacesRail = memo(SpacesRailImpl);
