import { Avatar, Badge, Button } from '../../components/primitives';
import type { ReactNode } from 'react';
import type { BotView } from '../equipe/team-view';
import { AGENT_STATUS, agentMeta } from './agent-list';

interface AgentRowProps {
  view: BotView;
  isLeader: boolean;
  onChat: (id: string) => void;
  onWorkspace: (id: string) => void;
  onProfile: (id: string) => void;
  menu?: ReactNode;
}

export function AgentRow({ view, isLeader, onChat, onWorkspace, onProfile, menu }: AgentRowProps) {
  const { bot, state } = view;
  const status = AGENT_STATUS[state];
  return (
    <div className="flex items-center gap-3.5 max-lg:flex-wrap max-lg:gap-x-2 max-lg:gap-y-2.5 border-b border-(--border) px-4 py-3.5 last:border-b-0">
      <button type="button" onClick={() => onProfile(bot.id)} aria-label={`Perfil de ${bot.name}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left max-lg:basis-full">
        <Avatar name={bot.name} color={bot.mascot.color} size={48} status={status.avatar} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium text-(--text)">{bot.name}</span>
            {isLeader && <Badge tone="orange">chefe</Badge>}
          </span>
          {bot.label && <span className="truncate text-[13px] text-(--text-strong)">{bot.label}</span>}
          <span className="truncate text-[11px] text-(--text-muted)">{agentMeta(view)}</span>
        </span>
      </button>
      <Badge tone={status.tone} dot className="w-32.5 justify-center max-lg:mr-auto max-lg:w-auto">{status.label}</Badge>
      <Button variant="secondary" size="sm" onClick={() => onWorkspace(bot.id)} aria-label={`Workspace de ${bot.name}`} icon="layers">
        <span className="max-lg:sr-only">Workspace</span>
      </Button>
      <Button variant="primary" size="sm" onClick={() => onChat(bot.id)} aria-label={`Chat com ${bot.name}`}>Chat</Button>
      {menu}
    </div>
  );
}
