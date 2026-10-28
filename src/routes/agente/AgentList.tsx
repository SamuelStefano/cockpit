import { Button, EmptyState, IconButton, ListRow } from '../../components/primitives';
import { TopBarAction } from '../../components/chrome/sidebar/TopBarSlot';
import { Mascot } from '../../components/team/Mascot';
import type { BotView } from '../equipe/team-view';
import { agentSubtitle } from './AgentHeader';
import type { TeamBot } from '../../../shared/protocol';

interface AgentListProps {
  views: BotView[];
  bots: TeamBot[];
  onOpen: (id: string) => void;
  onNew: () => void;
}

export function AgentList({ views, bots, onOpen, onNew }: AgentListProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 max-lg:hidden">
        <h1 className="flex-1 text-[22px] font-semibold tracking-[-0.02em] text-neutral-100">Agentes</h1>
        <Button variant="secondary" size="md" icon="plus" onClick={onNew}>Novo agente</Button>
      </div>
      <TopBarAction>
        <IconButton icon="plus" label="Novo agente" side="bottom" onClick={onNew} className="pointer-coarse:h-11 pointer-coarse:w-11" />
      </TopBarAction>
      {views.length === 0
        ? <EmptyState size="sm" icon="users" title="Nenhum agente ainda" description="Crie o primeiro para montar sua equipe." />
        : (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
            {views.map((v) => (
              <ListRow key={v.bot.id} onClick={() => onOpen(v.bot.id)}
                leading={<Mascot mascot={v.bot.mascot} state={v.state} size={32} name={v.bot.name} />}
                label={v.bot.name} hint={agentSubtitle(v.bot, bots)} />
            ))}
          </div>
        )}
    </div>
  );
}
