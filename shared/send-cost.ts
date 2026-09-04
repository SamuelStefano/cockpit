// Quanto o PRÓXIMO envio vai custar da janela de 5h, antes de mandar.
//
// O Deck é o único ponto que sabe, ao mesmo tempo, o contexto de cada sessão e o
// estado da cota: o CLI não conhece a cota, e a Anthropic não conhece o contexto
// das outras sessões. Por isso a conta mora aqui, pura, e roda IGUAL nos dois
// lados — o aviso do composer e a recusa do servidor precisam concordar, senão o
// usuário vê "12%" e leva um "não coube".
//
// Incidente que originou (04/09/2026): quatro sessões de 631k–780k tokens
// receberam prompt com o cache frio em 3min29s. Cada uma pagou o prefixo inteiro
// como cache_creation e a janela foi de ~20% a 100%. Ninguém viu o preço antes.

export interface Sample {
  ctxTokens: number;
  ts: number;
  model: string | null;
}

// Peso ponderado ≈ como a janela de 5h enxerga cada tipo de token. Não é tabela
// pública da Anthropic: foi calibrado contra o incidente (6,78M ponderados no
// bloco que bateu 100%). Por isso WINDOW_WEIGHTED é ajustável por env.
export const W_OUTPUT = 5;
export const W_CACHE_WRITE = 1.25;
export const W_CACHE_READ = 0.1;

// Saída típica de um turno. Some ~10k ponderados — ruído perto de um prefixo de
// 700k, mas evita estimar 0 numa sessão nova.
export const OUTPUT_ESTIMATE = 2_000;

// Prefixo sem uso há mais que isto conta como frio: o próximo envio reescreve o
// cache inteiro em vez de reler. É a diferença entre 0,07M e 0,86M no mesmo ctx.
export const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

// Ponderados que equivalem a 100% da janela de 5h.
export const DEFAULT_WINDOW_WEIGHTED = 6_800_000;

export interface SendCost {
  weighted: number;
  cold: boolean;
  ctxTokens: number;
  pctOfWindow: number;
}

export interface CostOpts {
  cacheTtlMs?: number;
  windowWeighted?: number;
}

// Estimativa deliberadamente PRA CIMA: assume que um envio frio reescreve o
// contexto inteiro, quando na prática um pedaço volta como cache_read (medido:
// ~3–6% de folga). Mesmo critério do priceOf em server/db.ts — subestimar gasto
// é pior que arredondar pra cima, porque o erro só aparece quando a janela morre.
export function estimateSendCost(s: Sample | null, now: number, o: CostOpts = {}): SendCost {
  const ttl = o.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const win = o.windowWeighted ?? DEFAULT_WINDOW_WEIGHTED;
  const out = OUTPUT_ESTIMATE * W_OUTPUT;

  if (!s || s.ctxTokens <= 0) {
    return { weighted: out, cold: false, ctxTokens: 0, pctOfWindow: pct(out, win) };
  }
  const cold = now - s.ts > ttl;
  const prefix = s.ctxTokens * (cold ? W_CACHE_WRITE : W_CACHE_READ);
  const weighted = prefix + out;
  return { weighted, cold, ctxTokens: s.ctxTokens, pctOfWindow: pct(weighted, win) };
}

function pct(weighted: number, win: number): number {
  if (win <= 0) return 0;
  return Math.round((weighted / win) * 1000) / 10; // uma casa: 13.9%, não 14%
}

// Cabe no que sobrou da janela? `fiveHour` é o percentual JÁ CONSUMIDO (0–100).
// Sem leitura de cota (poll falhou, browser fechado) devolve `true`: travar o
// envio por falta de informação é pior que o risco — o gate de ctx já segura o
// caso extremo, e o quota-gate existente cobre o 100% real.
export function fitsInWindow(cost: SendCost, fiveHour: number | null, o: CostOpts = {}): boolean {
  if (fiveHour === null || !Number.isFinite(fiveHour)) return true;
  const win = o.windowWeighted ?? DEFAULT_WINDOW_WEIGHTED;
  const remaining = Math.max(0, (100 - fiveHour) / 100) * win;
  return cost.weighted <= remaining;
}

// Rótulo pro composer. Curto de propósito: ele compete com o texto do usuário.
export function costLabel(c: SendCost): string {
  const k = Math.round(c.ctxTokens / 1000);
  const quando = c.cold ? 'cache frio' : 'cache quente';
  return `~${c.pctOfWindow}% da janela (contexto ${k}k, ${quando})`;
}
