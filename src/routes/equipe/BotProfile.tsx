import { useState } from 'react';
import type { ModelInfo, TeamBot, TeamBotInput } from '../../../shared/protocol';
import { Button, EmptyState, InlineEdit, Tabs } from '../../components/primitives';
import { Mascot } from '../../components/team/Mascot';
import { BotDetails } from './BotDetails';
import { withLabel } from './useBotForm';
import type { BotView } from './team-view';
import type { CronApi } from './equipe-props';

type ProfileTab = 'details' | 'files' | 'computer';
const TABS = [
  { id: 'details' as const, label: 'Detalhes' },
  { id: 'files' as const, label: 'Arquivos' },
  { id: 'computer' as const, label: 'Computador' },
];

interface BotProfileProps {
  view: BotView;
  bots: TeamBot[];
  models: ModelInfo[];
  onSave: (bot: TeamBotInput) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onBack?: () => void;
  connected: boolean;
  cronApi: CronApi;
}

export function BotProfile({ view, bots, models, onSave, onEdit, onDelete, onBack, connected, cronApi }: BotProfileProps) {
  const [tab, setTab] = useState<ProfileTab>('details');
  const { bot, state } = view;
  const saveLabel = (label: string) => onSave(withLabel(bot, label));
  return (
    <div className="flex h-full flex-col">
      {onBack && (
        <div className="px-2 pt-2">
          <Button variant="ghost" size="sm" icon="chevronLeft" onClick={onBack}>Conversa</Button>
        </div>
      )}
      <div className="flex flex-col items-center gap-1 px-4 pb-3 pt-6">
        <Mascot mascot={bot.mascot} state={state} size={84} name={bot.name} />
        <h2 className="mt-2 text-[17px] font-semibold text-neutral-100">{bot.name}</h2>
        <InlineEdit value={bot.label} onSave={saveLabel} label="cargo" hint={false}
          display={bot.label || <span className="text-neutral-600">Adicionar cargo</span>}
          validate={(v) => v.trim().length <= 60} className="text-[12.5px] text-neutral-400" />
      </div>
      <Tabs items={TABS} active={tab} onChange={setTab} className="justify-center px-3" />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {tab === 'details' && <BotDetails bot={bot} bots={bots} models={models} onEdit={onEdit} onDelete={onDelete} connected={connected} cronApi={cronApi} />}
        {tab === 'files' && <EmptyState icon="file" title="Em breve" description="As páginas e arquivos que o bot gerar vão aparecer aqui." />}
        {tab === 'computer' && <EmptyState icon="monitor" title="Em breve" description="A prévia do computador onde o bot trabalha vai aparecer aqui." />}
      </div>
    </div>
  );
}
