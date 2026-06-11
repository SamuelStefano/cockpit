// Autocomplete fantasma (ghost-text) do composer, estilo shell: a partir do que já
// foi digitado, propõe o sufixo do prompt mais recente do histórico que começa com
// o texto atual. Puro e testável — a montagem do overlay e a tecla de aceite ficam
// fora daqui. Retorna só o SUFIXO (o que falta digitar), nunca o prefixo.

// Sugere o complemento pra `value` varrendo `history` do mais recente pro mais antigo.
// Vazio quando: campo vazio, é um slash-command, tem quebra de linha, ou nada casa.
// Match é case-insensitive mas o sufixo preserva a grafia original do histórico.
export function suggestCompletion(history: string[], value: string): string {
  if (!value || value.startsWith('/') || value.includes('\n')) return '';
  const needle = value.toLowerCase();
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.length > value.length && h.toLowerCase().startsWith(needle)) {
      return h.slice(value.length);
    }
  }
  return '';
}

// Versão EXIBIDA do ghost: sufixos longos quebram linha além da altura do
// textarea e o overlay (overflow-hidden) clipa o chip de aceitar — invisível
// no mobile. Limita o que aparece; o aceite (Tab/chip) completa o texto inteiro.
export function clipGhost(ghost: string, max = 80): string {
  return ghost.length > max ? ghost.slice(0, max).trimEnd() + '…' : ghost;
}
