// Variantes de janela de 1M da Anthropic (`claude-opus-5[1m]`, `claude-fable-5-1[1m]`).
//
// Escolher uma no seletor GRUDA na sessão: o CLI para de compactar em ~180k e o
// contexto cresce até ~800k. Aí todo prompt com cache frio custa `ctx × 1,25` em
// cache_creation. Em 04/09/2026 quatro sessões nesse estado (631k, 681k, 691k,
// 780k) receberam prompt em 3min29s e levaram a janela de 5h de 20% a 100% — 82%
// do gasto foi cache write, zero trabalho novo.
//
// Puro e sem dependência: o servidor usa pra filtrar o seletor e recusar o argv, o
// cliente usa pra migrar pin salvo em localStorage.

export const LONG_CONTEXT_RE = /\[1m\]$/;

export function isLongContextModel(id: string): boolean {
  return LONG_CONTEXT_RE.test(id);
}

// `claude-opus-5[1m]` → `claude-opus-5`. Id sem a marca volta igual.
export function stripLongContext(id: string): string {
  return id.replace(LONG_CONTEXT_RE, '');
}
