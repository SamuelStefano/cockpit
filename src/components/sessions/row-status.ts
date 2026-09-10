import { fmtRunElapsed } from './row-meta';

export type RowStatusTone = 'green' | 'amber' | 'violet';

export interface RowStatus {
  tone: RowStatusTone;
  text: string;
  title: string;
}

interface RowStatusInput {
  running?: boolean;
  stalled?: boolean;
  waiting?: boolean;
  runStart?: number;
  relative: string;
  now?: number;
}

// Um único slot de estado por card, no rodapé, no lugar do "quando": o estado
// que trava ou ocupa a sessão É a informação de tempo relevante dela. Sem
// estado = null e o rodapé mostra o relativo normal.
export function rowStatus({ running, stalled, waiting, runStart, relative, now = Date.now() }: RowStatusInput): RowStatus | null {
  if (running) {
    const elapsed = runStart ? fmtRunElapsed(Math.max(0, now - runStart)) : '';
    if (stalled) return { tone: 'amber', text: elapsed ? `sem resposta · ${elapsed}` : 'sem resposta', title: 'Trabalhando, mas sem output há alguns minutos (tool longo, rate-limit ou travada)' };
    return { tone: 'green', text: elapsed ? `trabalhando · ${elapsed}` : 'trabalhando', title: 'Sessão trabalhando agora' };
  }
  if (waiting) return { tone: 'violet', text: `aguarda você · ${relative}`, title: 'Parou numa pergunta e aguarda sua resposta — a fila desta sessão está travada' };
  return null;
}

export const STATUS_TEXT: Record<RowStatusTone, string> = {
  green: 'text-green-400',
  amber: 'text-amber-400',
  violet: 'text-violet-300',
};

export const STATUS_DOT: Record<RowStatusTone, string> = {
  green: 'bg-green-400',
  amber: 'bg-amber-400',
  violet: 'bg-violet-400',
};
