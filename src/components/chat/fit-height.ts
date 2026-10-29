import { keyboardOpen as isKeyboardOpen } from '../../app/useKeyboardOpen';

// Teto do composer: cresce com o conteúdo até ~28% da viewport e depois rola por
// dentro. Era 40%/420px — alto demais: comia o thread e engolia as afordâncias de
// scroll. Clamp [120,260] pra não sumir no mobile nem dominar telas altas.
// Recalculado a cada chamada (cobre rotação/resize). Mede pelo visualViewport: com
// o teclado aberto o innerHeight pode continuar contando a área coberta, e o
// composer crescia até engolir as poucas linhas de thread que sobraram.
// Keyboard open: never above 40% of what is left (landscape would otherwise give the
// box most of a ~200px viewport), with a 96px floor.
export const composerMaxH = (keyboardOpen = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && isKeyboardOpen()): number => {
  const vh = typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 800;
  const base = Math.min(Math.max(Math.round(vh * 0.28), 120), 260);
  return keyboardOpen ? Math.max(96, Math.min(base, Math.round(vh * 0.4))) : base;
};

export const fitHeight = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, composerMaxH()) + 'px';
};
