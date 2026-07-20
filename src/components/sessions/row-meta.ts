export const CTX_WINDOW = 200_000;

// Sessão sem turno há mais de uma semana → "ociosa". Não desativa nada (o
// histórico segue intacto); só sinaliza pro usuário podar/arquivar o que esfriou.
const IDLE_MS = 7 * 24 * 60 * 60 * 1000;

// % da janela de contexto que a sessão ocupa. null quando não há leitura de
// contexto (sessão nunca rodou nesta conexão) — aí a UI não mostra medidor.
export function ctxPercent(ctx: number | undefined): number | null {
  if (!ctx || ctx <= 0) return null;
  return Math.min(100, Math.round((ctx / CTX_WINDOW) * 100));
}

// Alerta discreto de contexto no card: só aparece quando a sessão está de fato
// perto do teto (o progressbar permanente foi removido a pedido — #140).
export function ctxWarn(ctx: number | undefined): { pct: number; tone: 'yellow' | 'red' } | null {
  const pct = ctxPercent(ctx);
  if (pct === null || pct < 70) return null;
  return { pct, tone: pct >= 90 ? 'red' : 'yellow' };
}

// Ociosa = sem atividade recente E não rodando agora. Pin não importa aqui (uma
// sessão fixada pode estar fria); quem usa decide se o badge aparece.
export function isIdle(mtime: number, running: boolean, now = Date.now()): boolean {
  return !running && now - mtime > IDLE_MS;
}

// Custo compacto pro chip do card: valores altos viram "$1.9k" — o número gigante
// ("$1911.21") gritava mais que o título da sessão.
export function fmtCost(cost: number): string {
  // 999.5+ já compacta: senão o Math.round de baixo imprimia "$1000".
  if (cost >= 999.5) return `$${(cost / 1000).toFixed(1)}k`;
  if (cost >= 100) return `$${Math.round(cost)}`;
  if (cost >= 0.01) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(4)}`;
}

// Hora compacta pro canto do card: "22h atrás" → "22h". O sufixo repetido em
// toda linha só roubava largura do título.
export function shortRel(rel: string): string {
  return rel.replace(/\s*atrás$/, '');
}

export function fmtRunElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
