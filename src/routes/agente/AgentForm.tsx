import { useRef, useState, type ReactNode } from 'react';
import type { ModelInfo, TeamBot, TeamBotInput } from '../../../shared/protocol';
import { Button, Input, Switch, tokens } from '../../components/primitives';
import { useArmed } from '../../components/primitives/useArmed';
import { modelOptions } from '../../components/chat/model-options';
import { prettyModel } from '../../components/chat/toolbar-format';
import { isAgentModel } from '../../../shared/agents';
import { MascotPicker } from '../equipe/MascotPicker';
import { ProfileNote } from '../equipe/ProfileNote';
import { useBotForm } from '../equipe/useBotForm';
import { Permissions } from './Permissions';
import { permsFromProfile, profileFromPerms, type Perms } from './permissions';

const field = 'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-hidden focus:border-orange-500/40';

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-neutral-400">{label}</label>
      {children}
      {help && <p className="text-[12px] text-neutral-500">{help}</p>}
    </div>
  );
}

interface AgentFormProps {
  bot: TeamBot | null;
  bots: TeamBot[];
  models: ModelInfo[];
  locked: boolean;
  onSave: (bot: TeamBotInput) => void;
  onSaved: (id: string) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}

export function AgentForm({ bot, bots, models, locked, onSave, onSaved, onCancel, onDelete }: AgentFormProps) {
  const idRef = useRef('');
  const { id, draft, set, error, submit, parents } = useBotForm(bot, bots, onSave, () => onSaved(idRef.current), locked);
  idRef.current = id;
  const [perms, setPerms] = useState<Perms>(() => permsFromProfile(draft.profile));
  const del = useArmed();
  const changePerms = (next: Perms) => { setPerms(next); set('profile', profileFromPerms(next)); };
  const noAgents = draft.profile === 'restricted';
  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Field label="Mascote">
        <MascotPicker shape={draft.shape} color={draft.color} onShape={(s) => set('shape', s)} onColor={(c) => set('color', c)} />
      </Field>
      <Field label="Nome">
        <Input aria-label="Nome do bot" placeholder="nome (ex: growth-lead)" value={draft.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Cargo">
        <Input aria-label="Cargo" placeholder="cargo (ex: levanta fatos e fontes pra equipe)" value={draft.label} onChange={(e) => set('label', e.target.value)} />
      </Field>
      <Field label="Instruções" help="Em português, como se explicasse pra uma pessoa nova no time.">
        <textarea aria-label="Instruções" placeholder="O que esse agente faz, como fala, o que nunca faz…" rows={7}
          value={draft.instructions} onChange={(e) => set('instructions', e.target.value)} className={`${field} resize-y`} />
      </Field>
      <Field label="Modelo">
        <select aria-label="Modelo" value={draft.model} onChange={(e) => set('model', e.target.value)} className={field}>
          <option value="">modelo do chat</option>
          {modelOptions(models, draft.model).filter((o) => o.id !== '' && !(noAgents && isAgentModel(o.id))).map((o) => (
            <option key={o.id} value={o.id}>{prettyModel(o.id, o.displayName)}</option>
          ))}
        </select>
      </Field>
      <Field label="Permissões" help={'Sem "Escrever", o agente não altera arquivos nem publica — só entrega pra quem pode.'}>
        <Permissions value={perms} onChange={changePerms} disabled={locked} />
        {locked && <ProfileNote profile="restricted" />}
      </Field>
      <Field label="Responde a">
        <select aria-label="Chefe" value={draft.parentId} onChange={(e) => set('parentId', e.target.value)} className={field}>
          <option value="">ninguém</option>
          {parents.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      {!locked && <Switch checked={draft.primary} onChange={() => set('primary', !draft.primary)} icon="star" label="Agente principal" hint="O primeiro da equipe, que fala com você por padrão" />}
      <div className="sticky bottom-0 -mx-1 flex items-center gap-2 bg-neutral-950 px-1 py-3">
        {onDelete && bot && (
          <Button type="button" variant="danger" size="md" icon="trash" onClick={() => del.fire(() => onDelete(bot.id))}>
            {del.armed ? 'Confirmar remoção?' : 'Remover'}
          </Button>
        )}
        <span role="alert" className="min-w-0 flex-1 truncate text-[13px] text-red-400">{error}</span>
        <Button type="button" variant="ghost" size="md" onClick={onCancel}>Descartar</Button>
        <Button type="submit" variant="primary" size="md" icon={bot ? 'check' : 'plus'} className={tokens.focusRing}>{bot ? 'Salvar' : 'Criar'}</Button>
      </div>
    </form>
  );
}
