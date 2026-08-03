import type { ProviderDef } from './catalog';
import { type BreakerState, isOpen } from './breaker';

// Seleção da rota: lista ordenada + pula o que está em cooldown. É o `for` do
// OmniRoute sem as 18 estratégias de combo — prioridade explícita basta, e é a
// única ordem que o usuário consegue prever ("por que caiu nesse provedor?").

export interface RouteCandidate {
  provider: ProviderDef;
  enabled: boolean;
  priority: number;
}

export interface SelectOpts {
  now: number;
  breaker: BreakerState;
  // Tem credencial configurada? Provedor sem chave nunca é elegível — cair nele
  // seria trocar um turno que falha por outro turno que falha.
  hasCredential: (provider: ProviderDef) => boolean;
  exclude?: string[];
}

export type SkipReason = 'disabled' | 'no-credential' | 'cooling' | 'excluded';

export function skipReason(c: RouteCandidate, opts: SelectOpts): SkipReason | null {
  if (!c.enabled) return 'disabled';
  if (opts.exclude?.includes(c.provider.id)) return 'excluded';
  if (!opts.hasCredential(c.provider)) return 'no-credential';
  if (isOpen(opts.breaker, c.provider.id, opts.now)) return 'cooling';
  return null;
}

export function eligible(candidates: RouteCandidate[], opts: SelectOpts): RouteCandidate[] {
  return candidates
    .filter((c) => skipReason(c, opts) === null)
    .sort((a, b) => a.priority - b.priority || a.provider.id.localeCompare(b.provider.id));
}

// Melhor rota disponível AGORA. null = todas em cooldown/sem chave: nesse caso quem
// chama volta a segurar a fila (o comportamento antigo), em vez de queimar prompt.
export function selectRoute(candidates: RouteCandidate[], opts: SelectOpts): RouteCandidate | null {
  return eligible(candidates, opts)[0] ?? null;
}

// A rota ativa ainda é a melhor? Serve pro caminho de VOLTA: quando o plano sai do
// cooldown, o Deck precisa largar o provedor de emergência sozinho — foi o buraco
// do modo emergência manual, que ficava ligado até alguém lembrar de desligar.
export function shouldReturnTo(
  activeId: string,
  candidates: RouteCandidate[],
  opts: SelectOpts,
): RouteCandidate | null {
  const best = selectRoute(candidates, opts);
  if (!best || best.provider.id === activeId) return null;
  const active = candidates.find((c) => c.provider.id === activeId);
  // Só volta pra uma rota de prioridade MENOR (melhor). Se a ativa continua sendo a
  // melhor elegível, ou empata, fica onde está — trocar à toa perde o cache de prompt.
  if (active && best.priority >= active.priority) return null;
  return best;
}
