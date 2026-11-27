import type { TeamBot } from '../../../shared/protocol';
import { departmentById } from '../../../shared/departments';
import { Avatar, Badge, Button, IconButton } from '../../components/primitives';
import { TopBarAction } from '../../components/chrome/sidebar/TopBarSlot';
import type { BotState } from '../../components/team/botState';
import { AGENT_STATUS } from '../agentes-office/agent-list';

interface AgentHeaderProps {
  bot: TeamBot;
  bots: TeamBot[];
  state: BotState;
  onChat: () => void;
  onBack: () => void;
}

export function agentSubtitle(bot: TeamBot, bots: TeamBot[]): string {
  const boss = bots.find((b) => b.id === bot.parentId);
  const team = bots.filter((b) => b.parentId === bot.id).map((b) => b.name);
  return [
    departmentById(bot.department)?.name ?? 'Sem setor',
    bot.model,
    boss ? `responde a ${boss.name}` : bot.primary ? 'agente principal' : '',
    team.length ? `coordena ${team.join(', ')}` : '',
  ].filter(Boolean).join(' · ');
}

export function AgentHeader({ bot, bots, state, onChat, onBack }: AgentHeaderProps) {
  const status = AGENT_STATUS[state];
  return (
    <>
    <Button variant="ghost" size="sm" icon="chevronLeft" onClick={onBack} className="mb-3 max-sm:hidden">Agentes</Button>
    <div className="flex items-center gap-4 pb-5 max-lg:gap-3 max-lg:pb-3">
      <IconButton icon="chevronLeft" label="Voltar aos agentes" onClick={onBack} className="sm:hidden" />
      <Avatar name={bot.name} color={bot.mascot.color} size={72} status={status.avatar} className="max-lg:hidden" />
      <Avatar name={bot.name} color={bot.mascot.color} size={40} status={status.avatar} className="lg:hidden" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-neutral-100 max-lg:hidden">{bot.name}</h1>
          {bot.primary && <Badge tone="orange">principal</Badge>}
          <Badge tone={status.tone} dot>{status.label}</Badge>
        </div>
        {bot.label.trim() && <p className="truncate text-[14px] text-(--text-strong)">{bot.label}</p>}
        <p className="truncate text-[13px] text-(--text-muted)">{agentSubtitle(bot, bots)}</p>
      </div>
      <Button variant="primary" size="md" icon="message" onClick={onChat} className="max-lg:hidden">Chat</Button>
      <TopBarAction>
        <IconButton icon="message" label="Chat" side="bottom" onClick={onChat} className="pointer-coarse:h-11 pointer-coarse:w-11" />
      </TopBarAction>
    </div>
    </>
  );
}
