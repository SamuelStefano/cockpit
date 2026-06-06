import type { TurnStats } from '../../../shared/protocol';

// Janela de contexto dos modelos atuais ~200K tokens.
export const CONTEXT_LIMIT = 200_000;

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

export function turnStatParts(stats?: TurnStats): { parts: string[]; model: string } | null {
  if (!stats || (stats.costUsd === undefined && stats.durationMs === undefined)) return null;
  const parts: string[] = [];
  if (stats.costUsd !== undefined) parts.push('$' + stats.costUsd.toFixed(stats.costUsd < 0.01 ? 4 : 3));
  if (stats.durationMs !== undefined) parts.push((stats.durationMs / 1000).toFixed(1) + 's');
  return { parts, model: shortModel(stats.model) };
}

export function contextMeter(tokens: number): { pct: number; high: boolean; mid: boolean; k: string } | null {
  if (tokens <= 0) return null;
  const pct = Math.min(100, Math.round((tokens / CONTEXT_LIMIT) * 100));
  return { pct, high: pct >= 75, mid: pct >= 50, k: (tokens / 1000).toFixed(0) };
}
