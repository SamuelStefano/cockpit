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

// Quanto falta até o reset da janela de uso, em linguagem relativa.
export function fmtReset(ms: number | null): string {
  if (!ms) return '';
  const mins = Math.max(0, Math.round((ms - Date.now()) / 60000));
  if (mins <= 0) return 'em instantes';
  if (mins < 60) return `em ${mins}min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `em ${h}h${m}min` : `em ${h}h`;
}
