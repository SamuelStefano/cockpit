import { isLongContextModel } from './long-context';

// Tamanho da janela de contexto por VARIANTE do modelo. O Deck cravava 200k em
// três lugares (UsageRow, sessions/row-meta, lib/format), então uma sessão rodando
// um modelo `[1m]` aparecia 100% vermelha, "contexto quase cheio", com 210k de
// 1.000k usados — e o banner de saturação mandava migrar sem motivo.
export const DEFAULT_CONTEXT_WINDOW = 200_000;
export const LONG_CONTEXT_WINDOW = 1_000_000;

// Sem modelo conhecido assume a janela padrão: errar pra baixo só avisa cedo
// demais, enquanto assumir 1M numa sessão de 200k esconderia o teto de verdade.
export function contextWindowFor(model?: string | null): number {
  return model && isLongContextModel(model) ? LONG_CONTEXT_WINDOW : DEFAULT_CONTEXT_WINDOW;
}

// % da janela consumida, saturada em 100. Fonte única dos três medidores.
export function ctxPctOf(tokens: number, model?: string | null): number {
  if (!(tokens > 0)) return 0;
  return Math.min(100, Math.round((tokens / contextWindowFor(model)) * 100));
}
