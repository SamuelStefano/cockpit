import { ctxPct } from '../../lib/format';

// A partir daqui cada prompt reenvia quase a janela inteira: o custo do turno
// vira overhead de contexto, e a compactação passa minutos sem emitir frame.
// Abaixo disso o medidor do header já basta — o banner só aparece quando migrar
// vale mais do que continuar.
export const SATURATED_PCT = 80;
const CRITICAL_PCT = 92;

export interface Saturation {
  pct: number;
  k: string;
  critical: boolean;
}

export function saturation(tokens: number): Saturation | null {
  if (!tokens || tokens <= 0) return null;
  const pct = ctxPct(tokens);
  if (pct < SATURATED_PCT) return null;
  return { pct, k: (tokens / 1000).toFixed(0), critical: pct >= CRITICAL_PCT };
}

// Sessão `new-` ainda não existe no servidor: não há transcript pra destilar nem
// JSONL pra arquivar, então nem oferecemos a migração.
export function canHandoff(sessionId: string | undefined, busy: boolean): boolean {
  return !!sessionId && !sessionId.startsWith('new-') && !busy;
}
