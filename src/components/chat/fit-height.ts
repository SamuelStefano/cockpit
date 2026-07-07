// Teto do composer: cresce com o conteúdo até ~40% da viewport (como ChatGPT/Claude)
// e só então rola por dentro — antes travava em 140px e um prompt grande escondia as
// primeiras linhas. Clamp [160,420] pra não colar no topo em telas altas nem sumir
// no mobile. Recalculado a cada chamada (cobre rotação/resize).
export const composerMaxH = (): number => {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  return Math.min(Math.max(Math.round(vh * 0.4), 160), 420);
};

export const fitHeight = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, composerMaxH()) + 'px';
};
