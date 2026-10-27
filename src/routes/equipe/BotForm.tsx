import type { ModelInfo, TeamBot, TeamBotInput } from '../../../shared/protocol';
import { Button, Input, Modal, Switch } from '../../components/primitives';
import { modelOptions } from '../../components/chat/model-options';
import { prettyModel } from '../../components/chat/toolbar-format';
import { MascotPicker } from './MascotPicker';
import { useBotForm } from './useBotForm';
import { ProfileNote } from './ProfileNote';
import { isAgentModel } from '../../../shared/agents';

const field = 'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-hidden focus:border-orange-500/40';

interface BotFormProps {
  bot: TeamBot | null;
  bots: TeamBot[];
  models: ModelInfo[];
  locked?: boolean;
  onSave: (bot: TeamBotInput) => void;
  onClose: () => void;
}

export function BotForm({ bot, bots, models, locked = false, onSave, onClose }: BotFormProps) {
  const { draft, set, error, submit, parents } = useBotForm(bot, bots, onSave, onClose, locked);
  const noAgents = draft.profile === 'restricted';
  return (
    <Modal open onClose={onClose} title={bot ? `Editar ${bot.name}` : 'Novo bot'} icon="user"
      footer={(
        <div className="flex w-full items-center justify-between gap-2">
          <span role="alert" className="text-[13px] text-red-400">{error}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" size="sm" icon={bot ? 'check' : 'plus'} onClick={submit}>{bot ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      )}>
      <div className="flex flex-col gap-3">
        <MascotPicker shape={draft.shape} color={draft.color} onShape={(s) => set('shape', s)} onColor={(c) => set('color', c)} />
        <Input aria-label="Nome do bot" placeholder="nome (ex: growth-lead)" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        <Input aria-label="Cargo" placeholder="cargo (ex: coo do tainan)" value={draft.label} onChange={(e) => set('label', e.target.value)} />
        <textarea aria-label="Instruções" placeholder="O que esse bot faz, como fala, o que nunca faz…" rows={5}
          value={draft.instructions} onChange={(e) => set('instructions', e.target.value)} className={`${field} resize-y`} />
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Chefe" value={draft.parentId} onChange={(e) => set('parentId', e.target.value)} className={field}>
            <option value="">sem chefe</option>
            {parents.map((b) => <option key={b.id} value={b.id}>chefe: {b.name}</option>)}
          </select>
          {!locked && (
            <select aria-label="Perfil" value={draft.profile} onChange={(e) => set('profile', e.target.value as typeof draft.profile)} className={field}>
              <option value="full">perfil completo</option>
              <option value="restricted">perfil travado</option>
            </select>
          )}
          <select aria-label="Modelo" value={draft.model} onChange={(e) => set('model', e.target.value)} className={field}>
            <option value="">modelo do chat</option>
            {modelOptions(models, draft.model).filter((o) => o.id !== '' && !(noAgents && isAgentModel(o.id))).map((o) => (
              <option key={o.id} value={o.id}>{prettyModel(o.id, o.displayName)}</option>
            ))}
          </select>
          {!locked && (
            <select aria-label="Modo" value={draft.mode} onChange={(e) => set('mode', e.target.value as typeof draft.mode)} className={field}>
              <option value="">modo do chat</option>
              <option value="plan">Planejar</option>
              <option value="auto">Automático</option>
              <option value="acceptEdits">Executar</option>
            </select>
          )}
        </div>
        {locked && <ProfileNote profile="restricted" />}
        <Switch checked={draft.primary} onChange={() => set('primary', !draft.primary)} icon="star" label="Bot principal" hint="O primeiro da equipe, que fala com você por padrão" />
      </div>
    </Modal>
  );
}
