import type { TurnStats } from '../../../shared/protocol';
import { CONTEXT_LIMIT, ctxPct } from '../../lib/format';

export { CONTEXT_LIMIT };

// Modelo efetivo do CLI ("claude-opus-4-..." -> "opus", "claude-fable-5" ->
// "fable"); sob --fallback-model pode divergir do escolhido no picker. Genérico
// p/ qualquer família que a Anthropic lance, sem hardcode de opus/sonnet/haiku.
export function shortModel(m?: string): string {
  if (!m) return '';
  const fam = m.toLowerCase().match(/^claude-([a-z]+)/);
  return fam ? fam[1] : m;
}

// Família de um id de modelo, pra dedupe alias-vs-concreto no seletor. Concreto
// ("claude-fable-5") -> "fable"; alias puro ("opus") -> "opus"; não-Claude -> null.
export function modelFamily(m?: string): string | null {
  if (!m) return null;
  const lo = m.toLowerCase();
  const concrete = lo.match(/^claude-([a-z]+)/);
  if (concrete) return concrete[1];
  return /^[a-z]+$/.test(lo) ? lo : null;
}

// Rótulo legível com versão: "claude-opus-4-8" -> "Opus 4.8", "claude-fable-5" ->
// "Fable 5". Alias puro ("opus") -> "Opus". Prefere o display_name da API quando
// ele é amigável (não é só o id cru repetido). Não-Claude cai no id/displayName.
export function prettyModel(id?: string, displayName?: string): string {
  // Pseudo-modelos do CLI (ex: "<synthetic>" em mensagens injetadas) não são
  // versões reais — cai no rótulo genérico "Claude" em vez de vazar o token.
  if (id?.startsWith('<')) return '';
  if (displayName && displayName !== id) return displayName;
  if (!id) return '';
  const lo = id.toLowerCase();
  const fam = modelFamily(id);
  if (!fam) return displayName || id;
  const cap = fam[0].toUpperCase() + fam.slice(1);
  if (!lo.startsWith('claude-')) return cap;
  const v = lo.match(new RegExp(`-${fam}-(\\d+)(?:-(\\d+))?`));
  if (!v) return cap;
  return v[2] ? `${cap} ${v[1]}.${v[2]}` : `${cap} ${v[1]}`;
}

// Espelha a validação do servidor (engine/claude.ts): alias puro ou id concreto
// `claude-<...>`. Deixa o usuário usar um modelo recém-lançado na hora, sem esperar
// o /v1/models da conta refletir. Normaliza pra minúsculo e sem espaços.
export function normalizeModelId(raw: string): string | null {
  const m = raw.trim().toLowerCase();
  return /^(opus|sonnet|haiku|claude-[a-z0-9-]+)$/.test(m) ? m : null;
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
