import type { ModelInfo } from '../../../shared/protocol';
import { prettyModel, normalizeModelId } from './toolbar.format';
import { modelOptions } from './model-options';
import { usePersisted } from '../../lib/persist';
import { Icon, tokens } from '../primitives';

const ADD = '__add__';

export function ModelPicker({ model, setModel, models, onRefreshModels }: {
  model: string; setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
}) {
  const [customIds, setCustomIds] = usePersisted<string[]>('customModels', []);
  const sel = 'max-w-[130px] rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[11px] font-medium text-neutral-300 outline-none transition hover:border-neutral-700 focus:border-orange-500/40 sm:max-w-none sm:px-1.5 sm:py-1';
  const tag = 'hidden text-[9px] font-semibold uppercase tracking-wide text-neutral-600 sm:inline';
  // Modelos digitados à mão (ex: um recém-lançado ainda fora do /v1/models da conta).
  const customOpts: ModelInfo[] = customIds.map((id) => ({ id, displayName: id }));
  const list = modelOptions(models, model, customOpts).filter((o, i, a) => a.findIndex((x) => x.id === o.id) === i);

  const onChange = (value: string) => {
    if (value !== ADD) { setModel(value); return; }
    const id = normalizeModelId(window.prompt('ID do modelo (ex: claude-opus-5 ou claude-mythos-1):') ?? '');
    if (!id) return;
    if (!list.some((o) => o.id === id)) setCustomIds([...customIds, id]);
    setModel(id);
  };

  return (
    <label className="inline-flex shrink-0 items-center gap-1" title="Versão do agente do próximo prompt">
      <span className={tag}>versão</span>
      <select
        value={model}
        onChange={(e) => onChange(e.target.value)}
        className={sel}
      >
        {list.map((o) => <option key={o.id} value={o.id}>{prettyModel(o.id, o.displayName)}</option>)}
        <option value={ADD}>+ outro modelo…</option>
      </select>
      <button
        type="button"
        onClick={onRefreshModels}
        title="Buscar modelos novos da Anthropic agora"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-200 sm:h-[22px] sm:w-[22px] ${tokens.focusRing}`}
      >
        <Icon name="rotate" size={12} />
      </button>
    </label>
  );
}
