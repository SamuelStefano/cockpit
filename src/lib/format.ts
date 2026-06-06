export const CONTEXT_LIMIT = 200_000;

// % do contexto consumido, saturado em 100 — base do medidor mostrado no header,
// no rodapé e na toolbar do chat (os três derivam daqui pra não divergir).
export function ctxPct(tokens: number): number {
  return Math.min(100, Math.round((tokens / CONTEXT_LIMIT) * 100));
}

// Custo em USD com precisão decrescente conforme o valor cresce.
export function fmtCost(n: number): string {
  if (n >= 100) return '$' + n.toFixed(0);
  if (n >= 1) return '$' + n.toFixed(2);
  if (n > 0) return '$' + n.toFixed(3);
  return '$0';
}
