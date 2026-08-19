// Aparelho de toque (celular/tablet).
export function isTouchMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  return coarse || (navigator.maxTouchPoints ?? 0) > 0;
}

// Só teclado virtual: toque E nenhum ponteiro fino no aparelho. Notebook com tela
// sensível (ou iPad com trackpad/teclado) tem mouse e Shift+Enter de verdade, então
// não entra aqui.
export function isVirtualKeyboardOnly(): boolean {
  if (typeof window === 'undefined') return false;
  const fine = window.matchMedia?.('(any-pointer: fine)')?.matches ?? false;
  return isTouchMobile() && !fine;
}
