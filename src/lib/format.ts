import { contextWindowFor, ctxPctOf, DEFAULT_CONTEXT_WINDOW } from '../../shared/context-window';

export { contextWindowFor };
// Janela PADRÃO. Continua exportado porque o rótulo "de ~200k" precisa de um
// número quando a sessão não tem modelo conhecido; quem sabe o modelo usa
// `contextWindowFor`.
export const CONTEXT_LIMIT = DEFAULT_CONTEXT_WINDOW;

// % do contexto consumido, saturado em 100 — base do medidor mostrado no header,
// no rodapé e na toolbar do chat (os três derivam daqui pra não divergir). O
// modelo decide a janela: uma sessão `[1m]` mede sobre 1M, não sobre 200k.
export function ctxPct(tokens: number, model?: string | null): number {
  return ctxPctOf(tokens, model);
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
