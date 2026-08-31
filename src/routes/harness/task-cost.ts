import { fmtCost } from '../../../shared/format';

// O custo de uma task do harness tem dois estados que não são valor: ainda não medido
// (task em voo) e medido em zero (turno servido do cache/quota, não custou dinheiro).
// Ambos viravam "$0" antes, o que fazia "não sei" parecer "de graça". Só o terceiro
// caso é dinheiro, e aí vale o formatador canônico.
export function fmtTaskCost(usd?: number): string {
  if (usd == null) return '—';
  if (usd === 0) return 'grátis';
  return fmtCost(usd);
}
