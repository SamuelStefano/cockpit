// Teto do composer: cresce com o conteúdo até ~28% da viewport e depois rola por
// dentro. Era 40%/420px — alto demais: comia o thread e engolia as afordâncias de
// scroll. Clamp [120,260] pra não sumir no mobile nem dominar telas altas.
// Recalculado a cada chamada (cobre rotação/resize).
export const composerMaxH = (): number => {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  return Math.min(Math.max(Math.round(vh * 0.28), 120), 260);
};

export const fitHeight = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, composerMaxH()) + 'px';
};
