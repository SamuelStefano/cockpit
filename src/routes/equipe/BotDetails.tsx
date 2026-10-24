import type { ModelInfo, TeamBot } from '../../../shared/protocol';
import { Badge, Button } from '../../components/primitives';
import { useArmed } from '../../components/primitives/useArmed';
import { prettyModel } from '../../components/chat/toolbar-format';
import { DetailField as Field } from './DetailField';
import { BotRoutines } from './BotRoutines';
import { useBotRoutines } from './useBotRoutines';
import type { CronApi } from './equipe-props';

interface BotDetailsProps {
  bot: TeamBot;
  bots: TeamBot[];
  models: ModelInfo[];
  onEdit: () => void;
  onDelete: (id: string) => void;
  connected: boolean;
  cronApi: CronApi;
}

const MODE_LABEL = { plan: 'Planejar', auto: 'Automático', acceptEdits: 'Executar' } as const;

export function BotDetails({ bot, bots, models, onEdit, onDelete, connected, cronApi }: BotDetailsProps) {
  const del = useArmed();
  const routines = useBotRoutines({ ...cronApi, botId: bot.id, connected });
  const boss = bots.find((b) => b.id === bot.parentId);
  const reports = bots.filter((b) => b.parentId === bot.id).map((b) => b.name);
  const model = bot.model ? prettyModel(bot.model, models.find((m) => m.id === bot.model)?.displayName) : 'padrão do chat';
  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Instruções">
        {bot.instructions.trim()
          ? <p className="whitespace-pre-wrap leading-relaxed">{bot.instructions}</p>
          : <span className="text-neutral-600">Sem instruções — o bot só sabe o nome e o cargo.</span>}
      </Field>
      <Field label="Chefe">{boss ? boss.name : <span className="text-neutral-600">ninguém</span>}</Field>
      {reports.length > 0 && <Field label="Equipe dele">{reports.join(', ')}</Field>}
      <Field label="Perfil">
        <Badge tone={bot.profile === 'restricted' ? 'yellow' : 'neutral'}>{bot.profile === 'restricted' ? 'restrito' : 'completo'}</Badge>
      </Field>
      <Field label="Modelo">{model}{bot.mode ? ` · ${MODE_LABEL[bot.mode]}` : ''}{bot.effort ? ` · esforço ${bot.effort}` : ''}</Field>
      <BotRoutines r={routines} />
      <div className="flex items-center gap-2 pt-1">
        <Button variant="secondary" size="sm" icon="pencil" onClick={onEdit}>Editar</Button>
        <Button variant="danger" size="sm" icon="trash" onClick={() => del.fire(() => onDelete(bot.id))}>
          {del.armed ? 'Confirmar remoção?' : 'Remover'}
        </Button>
      </div>
    </div>
  );
}
