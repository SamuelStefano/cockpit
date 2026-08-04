import type { RoutesSnapshot, RouteView } from '../../../shared/protocol';

export interface RouteBannerView {
  label: string;      // provedor em uso agora
  tier: string;       // free | cheap | paid
  detail: string;     // por que saiu do plano e quando volta
  backAt: string | null;
}

const TIER_PT: Record<string, string> = { free: 'grátis', cheap: 'barato', paid: 'pago', plan: 'plano' };

export function tierLabel(tier: string): string {
  return TIER_PT[tier] ?? tier;
}

export function tierTone(tier: string): 'green' | 'yellow' | 'orange' | 'neutral' {
  return tier === 'free' ? 'green' : tier === 'cheap' ? 'yellow' : tier === 'paid' ? 'orange' : 'neutral';
}

export function planRoute(snap: RoutesSnapshot): RouteView | undefined {
  return snap.routes.find((r) => r.tier === 'plan');
}

export function activeRoute(snap: RoutesSnapshot): RouteView | undefined {
  return snap.routes.find((r) => r.id === snap.activeId);
}

export function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Banner só existe quando o Deck NÃO está no plano — no plano o silêncio é o
// estado certo (a barra de uso já cobre). `null` = nada a mostrar.
export function routeBanner(snap: RoutesSnapshot | null, now = Date.now()): RouteBannerView | null {
  if (!snap || !snap.enabled) return null;
  const active = activeRoute(snap);
  if (!active || active.tier === 'plan') return null;
  const plan = planRoute(snap);
  const until = plan && plan.cooldownUntil > now ? plan.cooldownUntil : 0;
  const backAt = until ? hhmm(until) : null;
  const why = plan?.lastKind === 'quota_exhausted' ? 'Tokens do plano esgotados'
    : plan?.lastKind === 'rate_limit' ? 'Plano em rate limit'
    : plan?.lastKind === 'auth' ? 'Plano sem credencial válida'
    : 'Fora do plano';
  const detail = backAt ? `${why} — volta sozinho às ${backAt}` : `${why} — volta ao plano no próximo turno livre`;
  return { label: active.label, tier: active.tier, detail, backAt };
}

// A composição fica pausada por teto de tokens SÓ quando não há para onde ir. Não
// basta olhar a rota ativa: o servidor troca de provedor no momento em que o turno
// dispara, então com um fallback pronto o campo tem que continuar liberado mesmo
// enquanto o plano ainda é a rota corrente.
export function quotaBlocksInput(snap: RoutesSnapshot | null): boolean {
  if (snap?.enabled && snap.hasFallback) return false;
  return routeBanner(snap) === null;
}
