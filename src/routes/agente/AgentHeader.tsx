import type { TeamBot } from '../../../shared/protocol';
import { Button, IconButton } from '../../components/primitives';
import { TopBarAction } from '../../components/chrome/sidebar/TopBarSlot';
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
    <div className="flex items-center gap-4 pb-5 max-lg:gap-3 max-lg:pb-3">
      <IconButton icon="chevronLeft" label="Voltar aos agentes" onClick={onBack} className="sm:hidden" />
      <Mascot mascot={bot.mascot} state={state} size={56} name={bot.name} className="max-lg:hidden" />
      <Mascot mascot={bot.mascot} state={state} size={40} name={bot.name} className="lg:hidden" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] max-lg:hidden font-semibold tracking-[-0.02em] text-neutral-100">{bot.name}</h1>
        <p className="truncate text-[13px] text-neutral-500">{agentSubtitle(bot, bots)}</p>
      </div>
      <Button variant="secondary" size="md" icon="message" onClick={onChat} className="max-lg:hidden">Conversar</Button>
      <TopBarAction>
        <IconButton icon="message" label="Conversar" side="bottom" onClick={onChat} className="pointer-coarse:h-11 pointer-coarse:w-11" />
      </TopBarAction>
    </div>
  );
}
