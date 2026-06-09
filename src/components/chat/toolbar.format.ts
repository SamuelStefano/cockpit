import type { TurnStats } from '../../../shared/protocol';
import { CONTEXT_LIMIT, ctxPct } from '../../lib/format';

export { CONTEXT_LIMIT };

// Modelo efetivo do CLI ("claude-opus-4-..." -> "opus"); sob --fallback-model
// pode divergir do escolhido no picker.
export function shortModel(m?: string): string {
  if (!m) return '';
  const lo = m.toLowerCase();
  if (lo.includes('opus')) return 'opus';
  if (lo.includes('sonnet')) return 'sonnet';
  if (lo.includes('haiku')) return 'haiku';
  return m;
}

// Família de um id de modelo, pra dedupe alias-vs-concreto no seletor.
export function modelFamily(m?: string): 'opus' | 'sonnet' | 'haiku' | null {
  if (!m) return null;
  const lo = m.toLowerCase();
  if (lo.includes('opus')) return 'opus';
  if (lo.includes('sonnet')) return 'sonnet';
  if (lo.includes('haiku')) return 'haiku';
  return null;
}

// Rótulo legível com versão: "claude-opus-4-8" -> "Opus 4.8". Alias puro sem
// versão ("opus") -> "Opus". Prefere o display_name da API quando ele é amigável
// (não é só o id cru repetido). Não-Claude cai no id/displayName original.
export function prettyModel(id?: string, displayName?: string): string {
  if (displayName && displayName !== id) return displayName;
  if (!id) return '';
  const fam = modelFamily(id);
  if (!fam) return displayName || id;
  const cap = fam[0].toUpperCase() + fam.slice(1);
  const v = id.toLowerCase().match(/(?:opus|sonnet|haiku)-(\d+)-(\d+)/);
  return v ? `${cap} ${v[1]}.${v[2]}` : cap;
}

export function turnStatParts(stats?: TurnStats): { parts: string[]; model: string } | null {
  if (!stats || (stats.costUsd === undefined && stats.durationMs === undefined)) return null;
  const parts: string[] = [];
  if (stats.costUsd !== undefined) parts.push('$' + stats.costUsd.toFixed(stats.costUsd < 0.01 ? 4 : 3));
  if (stats.durationMs !== undefined) parts.push((stats.durationMs / 1000).toFixed(1) + 's');
  return { parts, model: shortModel(stats.model) };
}

export function contextMeter(tokens: number): { pct: number; high: boolean; mid: boolean; k: string } | null {
  if (tokens <= 0) return null;
  const pct = ctxPct(tokens);
  return { pct, high: pct >= 75, mid: pct >= 50, k: (tokens / 1000).toFixed(0) };
}
