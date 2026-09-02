// Cor da borda da UsageBar por estado de cota. No celular a barra do header é o
// ÚNICO aviso (a pílula flutuante saiu do chat, A1), então ela precisa mudar de
// cor sozinha em vez de depender de um banner por cima do thread.
export function quotaBorder(warn: boolean, paused: boolean): string {
  if (paused) return 'border-red-500/60 hover:border-red-500';
  if (warn) return 'border-amber-500/50 hover:border-amber-400';
  return 'border-neutral-800 hover:border-neutral-700';
}
