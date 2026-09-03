import type { Effort } from '../../../shared/protocol';

// Nível de pensamento (--effort) por sessão, igual ao seletor dos chats do Claude.
// Default 'low': sem effort explícito o CLI usa o default da conta (alto), que queima
// thinking tokens até num pedido simples — o maior driver de gasto do Deck.
export const EFFORT_LEVELS: { id: Effort; label: string; hint: string }[] = [
  { id: 'low', label: 'Baixo', hint: 'pensa pouco — mais barato e rápido' },
  { id: 'medium', label: 'Médio', hint: 'equilíbrio entre custo e raciocínio' },
  { id: 'high', label: 'Alto', hint: 'pensa bastante — tarefas difíceis' },
  { id: 'xhigh', label: 'Muito alto', hint: 'raciocínio estendido — caro' },
  { id: 'max', label: 'Máximo', hint: 'pensamento máximo — mais caro' },
];

export const effortLabel = (e: Effort): string => EFFORT_LEVELS.find((l) => l.id === e)?.label ?? e;
