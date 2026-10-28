import type { TeamBot } from '../../../shared/protocol';
import { Button, IconButton } from '../../components/primitives';
import { Mascot } from '../../components/team/Mascot';
import type { BotState } from '../../components/team/botState';

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
    bot.label.trim() || 'Agente',
    boss ? `responde a ${boss.name}` : bot.primary ? 'agente principal' : '',
    team.length ? `coordena ${team.join(', ')}` : '',
  ].filter(Boolean).join(' · ');
}

export function AgentHeader({ bot, bots, state, onChat, onBack }: AgentHeaderProps) {
  return (
    <div className="flex items-center gap-4 pb-5">
      <IconButton icon="chevronLeft" label="Voltar aos agentes" onClick={onBack} className="sm:hidden" />
      <Mascot mascot={bot.mascot} state={state} size={56} name={bot.name} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-neutral-100">{bot.name}</h1>
        <p className="truncate text-[13px] text-neutral-500">{agentSubtitle(bot, bots)}</p>
      </div>
      <Button variant="secondary" size="md" icon="message" onClick={onChat}>Conversar</Button>
    </div>
  );
}
