import type { ModelInfo } from '../../../shared/protocol';
import { prettyModel, modelFamily, normalizeModelId } from './toolbar.format';
import { usePersisted } from '../../lib/persist';
import { Icon } from '../primitives';

const ADD = '__add__';

// Versão concreta do agente por sessão (ex: Opus 4.8), puxada de /v1/models pelo
// backend. Repassada como --model (id validado por allow-list no servidor). Sem
// a lista (boot/offline) cai nos aliases opus/sonnet/haiku, que o CLI aceita.
const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'opus', displayName: 'Opus' },
  { id: 'sonnet', displayName: 'Sonnet' },
  { id: 'haiku', displayName: 'Haiku' },
];

// A conta pode expor só uma família concreta em /v1/models (ex: só Opus 4.8). Pra
// não deixar o seletor com uma opção só, completamos com os aliases das famílias
// ausentes (sonnet/haiku) — o CLI aceita o alias e resolve a versão mais recente.
function withFamilies(models: ModelInfo[]): ModelInfo[] {
  const have = new Set(models.map((m) => FALLBACK_MODELS.find((f) => m.id.includes(f.id))?.id));
  const extra = FALLBACK_MODELS.filter((f) => !have.has(f.id));
  return [...models, ...extra];
}

export function ModelPicker({ model, setModel, models, onRefreshModels, disabled }: {
  model: string; setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  disabled: boolean;
}) {
  const [customIds, setCustomIds] = usePersisted<string[]>('customModels', []);
  const sel = 'rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[11px] font-medium text-neutral-300 outline-none transition hover:border-neutral-700 focus:border-orange-500/40 disabled:cursor-not-allowed disabled:opacity-50';
  const tag = 'text-[9px] font-semibold uppercase tracking-wide text-neutral-600';
  const base = models.length ? withFamilies(models) : FALLBACK_MODELS;
  // Modelos digitados à mão (ex: um recém-lançado ainda fora do /v1/models da conta),
  // sem duplicar o que a lista ao vivo já trouxe.
  const customOpts: ModelInfo[] = customIds.filter((id) => !base.some((o) => o.id === id)).map((id) => ({ id, displayName: id }));
  const opts = [...base, ...customOpts];
  // Garante que o modelo atual apareça na lista mesmo que não esteja em /v1/models
  // (modelo descontinuado) — senão o select renderiza vazio. Mas se já existe uma
  // versão concreta da MESMA família (ex: 'opus' salvo e 'claude-opus-4-8' na lista),
  // não duplicamos — o useCockpit promove o alias pro id concreto no frame 'models'.
  const fam = modelFamily(model);
  const covered = opts.some((o) => o.id === model) || (fam && opts.some((o) => modelFamily(o.id) === fam));
  const list = covered ? opts : [{ id: model, displayName: model }, ...opts];

  const onChange = (value: string) => {
    if (value !== ADD) { setModel(value); return; }
    const id = normalizeModelId(window.prompt('ID do modelo (ex: claude-opus-5 ou claude-mythos-1):') ?? '');
    if (!id) return;
    if (!opts.some((o) => o.id === id)) setCustomIds([...customIds, id]);
    setModel(id);
  };

  return (
    <label className="inline-flex items-center gap-1" title="Versão do agente desta sessão">
      <span className={tag}>versão</span>
      <select
        value={model}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={sel}
      >
        {list.map((o) => <option key={o.id} value={o.id}>{prettyModel(o.id, o.displayName)}</option>)}
        <option value={ADD}>+ outro modelo…</option>
      </select>
      <button
        type="button"
        onClick={onRefreshModels}
        disabled={disabled}
        title="Buscar modelos novos da Anthropic agora"
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="rotate" size={12} />
      </button>
    </label>
  );
}
