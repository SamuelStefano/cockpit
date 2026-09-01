import type { ModelInfo } from '../../../shared/protocol';
import { modelFamily } from './toolbar-format';

// Versão concreta do agente, puxada de /v1/models pelo backend. Sem a lista
// (boot/offline) cai nos aliases opus/sonnet/haiku, que o CLI aceita.
export const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'opus', displayName: 'Opus' },
  { id: 'sonnet', displayName: 'Sonnet' },
  { id: 'haiku', displayName: 'Haiku' },
];

// A conta pode expor só uma família concreta em /v1/models (ex: só Opus 4.8). Pra
// não deixar o seletor com uma opção só, completamos com os aliases das famílias
// ausentes (sonnet/haiku) — o CLI aceita o alias e resolve a versão mais recente.
export function withFamilies(models: ModelInfo[]): ModelInfo[] {
  const have = new Set(models.map((m) => FALLBACK_MODELS.find((f) => m.id.includes(f.id))?.id));
  const extra = FALLBACK_MODELS.filter((f) => !have.has(f.id));
  return [...models, ...extra];
}

// Lista final do seletor. Garante que `current` apareça mesmo fora de /v1/models
// (modelo descontinuado) — senão o select renderiza vazio. Mas se já existe uma
// versão concreta da MESMA família (ex: 'opus' salvo e 'claude-opus-4-8' na lista),
// não duplicamos.
export function modelOptions(models: ModelInfo[], current: string, extra: ModelInfo[] = []): ModelInfo[] {
  const opts = [...(models.length ? withFamilies(models) : FALLBACK_MODELS), ...extra];
  const fam = modelFamily(current);
  const covered = opts.some((o) => o.id === current) || (fam && opts.some((o) => modelFamily(o.id) === fam));
  return covered ? opts : [{ id: current, displayName: current }, ...opts];
}
