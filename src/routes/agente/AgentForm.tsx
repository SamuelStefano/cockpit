import { useRef, useState, type ReactNode } from 'react';
import type { ModelInfo, SkillMeta, TeamBot, TeamBotInput } from '../../../shared/protocol';
import { Button, Input, Switch, tokens } from '../../components/primitives';
import { useArmed } from '../../components/primitives/useArmed';
import { MascotPicker } from '../equipe/MascotPicker';
import { ProfileNote } from '../equipe/ProfileNote';
import { useBotForm } from '../equipe/useBotForm';
import { BotBuilder } from '../equipe/BotBuilder';
import { BotTemplate } from '../equipe/BotTemplate';
import type { AgentBuildRequest, AgentBuildResult } from '../../cockpit/useTeam';
import { useBuilderPanels } from './useBuilderPanels';
import { ModelSection } from './ModelSection';
import { Permissions } from './Permissions';
import { SkillPicker } from './SkillPicker';
import { permsFromProfile, profileFromPerms, type Perms } from './perms';

const field = 'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-hidden focus:border-orange-500/40';

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 max-lg:gap-1">
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
  skills?: SkillMeta[];
  onSave: (bot: TeamBotInput) => void;
  onSaved: (id: string) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  agentBuild?: AgentBuildResult | null;
  onAgentBuild?: (req: AgentBuildRequest) => boolean;
}

export function AgentForm({ bot, bots, models, locked, skills = [], onSave, onSaved, onCancel, onDelete, agentBuild = null, onAgentBuild }: AgentFormProps) {
  const idRef = useRef('');
  const { id, draft, set, patch, error, submit, parents } = useBotForm(bot, bots, onSave, () => onSaved(idRef.current), locked);
  idRef.current = id;
  const [perms, setPerms] = useState<Perms>(() => draft.permissions ?? permsFromProfile(draft.profile));
  const del = useArmed();
  const changePerms = (next: Perms) => { setPerms(next); set('permissions', next); set('profile', profileFromPerms(next)); };
  const noAgents = draft.profile === 'restricted';
  const b = useBuilderPanels(patch);
  return (
    <>
      <form className="flex flex-col gap-5 max-lg:gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {onAgentBuild && !locked && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" icon="sparkles" onClick={() => b.setPanel('builder')}>{bot ? 'Ajustar conversando' : 'Criar conversando'}</Button>
            <Button type="button" variant="ghost" size="sm" icon="link" onClick={() => b.setPanel('template')}>Compartilhar ou receber</Button>
          </div>
        )}
        {b.notice && <p role="note" className="text-[13px] text-yellow-400/90">{b.notice}</p>}
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
          <textarea aria-label="Instruções" placeholder="O que esse agente faz, como fala, o que nunca faz…" rows={6}
            value={draft.instructions} onChange={(e) => set('instructions', e.target.value)} className={`${field} resize-none`} />
        </Field>
        <Field label="Modelo">
          <ModelSection model={draft.model} fallbackModel={draft.fallbackModel} models={models} noAgents={noAgents}
            onModel={(id) => set('model', id)} onFallback={(id) => set('fallbackModel', id)} />
        </Field>
        <Field label="Permissões" help={'Sem "Escrever", o agente não altera arquivos nem publica — só entrega pra quem pode.'}>
          <Permissions value={perms} onChange={changePerms} disabled={locked} />
          {locked && <ProfileNote profile="restricted" />}
        </Field>
        {skills.length > 0 && (
          <Field label="Skills" help="Sem seleção, o agente usa todas.">
            <SkillPicker skills={skills} value={draft.skills} perms={perms} onChange={(v) => set('skills', v)} />
          </Field>
        )}
        <Field label="Responde a">
          <select aria-label="Chefe" value={draft.parentId} onChange={(e) => set('parentId', e.target.value)} className={field}>
            <option value="">ninguém</option>
            {parents.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        {!locked && <Switch checked={draft.primary} onChange={() => set('primary', !draft.primary)} icon="star" label="Agente principal" hint="O primeiro da equipe, que fala com você por padrão" />}
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-2 bg-neutral-950 px-1 py-3 max-sm:-mx-4 max-lg:border-t max-lg:border-neutral-800 max-sm:px-4 max-lg:pb-[max(12px,env(safe-area-inset-bottom))]">
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
      {b.panel === 'builder' && onAgentBuild && (
        <BotBuilder initial={{ name: draft.name, label: draft.label, instructions: draft.instructions, skills: draft.skills }} skills={skills}
          result={agentBuild} onBuild={onAgentBuild} onAccept={b.accept} onClose={() => b.setPanel(null)} />
      )}
      {b.panel === 'template' && <BotTemplate draft={draft} skills={skills} onImport={b.imported} onClose={() => b.setPanel(null)} />}
    </>
  );
}
