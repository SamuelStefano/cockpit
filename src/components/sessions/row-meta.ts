import { ctxPctOf, DEFAULT_CONTEXT_WINDOW } from '../../../shared/context-window';

// Janela padrão. O medidor do card usa a do MODELO da sessão (uma sessão `[1m]`
// mede sobre 1M) — este valor só é o fallback de quem não sabe o modelo.
export const CTX_WINDOW = DEFAULT_CONTEXT_WINDOW;

// Sessão sem turno há mais de uma semana → "ociosa". Não desativa nada (o
// histórico segue intacto); só sinaliza pro usuário podar/arquivar o que esfriou.
const IDLE_MS = 7 * 24 * 60 * 60 * 1000;

// % da janela de contexto que a sessão ocupa. null quando não há leitura de
// contexto (sessão nunca rodou nesta conexão) — aí a UI não mostra medidor.
export function ctxPercent(ctx: number | undefined, model?: string | null): number | null {
  if (!ctx || ctx <= 0) return null;
  return ctxPctOf(ctx, model);
}

// Alerta discreto de contexto no card: só aparece quando a sessão está de fato
// perto do teto (o progressbar permanente foi removido a pedido — #140).
export interface CtxWarn { pct: number; tone: 'yellow' | 'red' }

export function ctxWarn(ctx: number | undefined, model?: string | null): CtxWarn | null {
  const pct = ctxPercent(ctx, model);
  if (pct === null || pct < 70) return null;
  return { pct, tone: pct >= 90 ? 'red' : 'yellow' };
}

// Ociosa = sem atividade recente E não rodando agora. Pin não importa aqui (uma
// sessão fixada pode estar fria); quem usa decide se o badge aparece.
export function isIdle(mtime: number, running: boolean, now = Date.now()): boolean {
  return !running && now - mtime > IDLE_MS;
}

export function fmtRunElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
