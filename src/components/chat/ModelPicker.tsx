import type { ModelInfo } from '../../../shared/protocol';
import { prettyModel } from './toolbar-format';
import type { VisibleOption } from '../../lib/model-visibility';
import { useModelPicker, ADD_OPTION, MANAGE_OPTION } from './useModelPicker';
import { Icon, tokens } from '../primitives';

const sel = 'max-w-[130px] rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] font-medium text-neutral-300 outline-hidden transition hover:border-neutral-700 focus:border-orange-500/40 sm:max-w-none sm:px-1.5 sm:py-1';
const chip = 'max-w-28 truncate rounded-full border-0 bg-transparent px-2 py-1.5 text-[12px] font-medium text-neutral-400 outline-hidden transition hover:bg-neutral-800 hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-orange-500/40 sm:max-w-44 pointer-coarse:min-h-11';
const tag = 'hidden text-[12px] font-semibold uppercase tracking-wide text-neutral-600 sm:inline';

const renderOpt = (o: VisibleOption) => (
  <option key={o.id} value={o.id}>{prettyModel(o.id, o.displayName)}{o.hidden ? ' (oculto)' : ''}</option>
);

export function ModelPicker({ model, setModel, models, onRefreshModels, canManage = false, locked, compact = false }: {
  model: string; setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  canManage?: boolean;
  locked?: string;
  // Chip for the composer box: short name only, no tag and no refresh button.
  compact?: boolean;
}) {
  if (locked) return <LockedModel model={model} models={models} reason={locked} compact={compact} />;
  return <ModelSelect model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels} canManage={canManage} compact={compact} />;
}

function LockedModel({ model, models, reason, compact }: { model: string; models: ModelInfo[]; reason: string; compact: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex max-w-28 shrink-0 items-center gap-1 truncate px-2 text-[12px] font-medium text-neutral-400 sm:max-w-44" title={`Modelo ${reason} — troque no perfil do bot`}>
        <Icon name="lock" size={10} />
        {prettyModel(model, models.find((m) => m.id === model)?.displayName)}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={`Modelo ${reason} — troque no perfil do bot`}>
      <span className={tag}>versão</span>
      <span className="inline-flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[12px] font-medium text-neutral-300">
        <Icon name="lock" size={10} />
        {prettyModel(model, models.find((m) => m.id === model)?.displayName)}
        <span className="text-neutral-600">· {reason}</span>
      </span>
    </span>
  );
}

function ModelSelect({ model, setModel, models, onRefreshModels, canManage, compact }: {
  model: string; setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  canManage: boolean;
  compact: boolean;
}) {
  const { groups, refreshing, refresh, adding, custom, setCustom, onChange, commitCustom, cancelCustom } =
    useModelPicker({ model, setModel, models, onRefreshModels });

  return (
    <label className="inline-flex shrink-0 items-center gap-1" title="Versão do agente do próximo prompt">
      {!compact && <span className={tag}>versão</span>}
      {adding ? (
        <input
          autoFocus
          aria-label="ID do modelo"
          placeholder="claude-opus-5"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') { e.preventDefault(); commitCustom(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelCustom(); }
          }}
          onBlur={commitCustom}
          className={`${sel} w-36 font-mono`}
        />
      ) : (
        <select
          // The visible "versão" tag is hidden on mobile, which left the select nameless.
          aria-label="Versão do agente do próximo prompt"
          value={model}
          onChange={(e) => onChange(e.target.value)}
          className={compact ? chip : sel}
        >
          {groups.anthropic.length > 0 && <optgroup label="Anthropic · Claude">{groups.anthropic.map(renderOpt)}</optgroup>}
          {groups.others.length > 0 && <optgroup label="Outros agentes">{groups.others.map(renderOpt)}</optgroup>}
          <option value={ADD_OPTION}>+ outro modelo…</option>
          {canManage && <option value={MANAGE_OPTION}>Gerenciar modelos…</option>}
        </select>
      )}
      {!compact && <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        title="Buscar modelos novos da Anthropic agora"
        aria-label={refreshing ? 'Buscando modelos…' : 'Buscar modelos novos da Anthropic agora'}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-200 sm:h-[22px] sm:w-[22px] ${tokens.focusRing}`}
      >
        <Icon name="rotate" size={12} className={refreshing ? 'spin text-orange-400' : ''} />
      </button>}
    </label>
  );
}
