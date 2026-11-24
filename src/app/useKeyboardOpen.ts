import { useState, useEffect } from 'react';
import { viewportShrunk } from './keyboard-shrunk';

// Teclado virtual aberto = viewport visível bem menor que a maior já vista (keyboard-shrunk).
// Com `interactive-widget=resizes-content` (o do index.html) o browser encolhe a
// PRÓPRIA janela ao abrir o teclado: visualViewport.height passa a ser igual a
// innerHeight e a razão acima nunca dispara. A media query curta é o sinal desse
// caso — e também o fallback de quem não tem a API.
const SHORT = '(max-height: 500px)';

// Celular deitado também tem menos de 500px de altura, sem teclado nenhum — a
// query sozinha escondia toolbar e agentes em background em landscape.
// Teclado só abre com um campo de texto focado, então a query exige esse foco.
// `(orientation: portrait)` não serviria: com resizes-content a janela vira
// "landscape" justamente quando o teclado abre.
function editableFocused(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement || el.isContentEditable) return true;
  return el instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset'].includes(el.type);
}

export function keyboardOpen(): boolean {
  const short = window.matchMedia(SHORT).matches && editableFocused();
  const vv = window.visualViewport;
  if (!vv) return short;
  return short || viewportShrunk(vv.height, window.innerHeight, window.innerWidth);
}

// Estado inicial já LÊ o valor (mesmo motivo do useIsMobile): abrir o chat com o
// teclado já aberto não pode passar por um render de layout alto.
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(keyboardOpen);
  useEffect(() => {
    const apply = () => setOpen(keyboardOpen());
    apply();
    let settle = 0;
    const applyLater = () => { apply(); clearTimeout(settle); settle = window.setTimeout(apply, 350); };
    const mq = window.matchMedia(SHORT);
    const vv = window.visualViewport;
    mq.addEventListener('change', apply);
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    document.addEventListener('focusin', applyLater);
    document.addEventListener('focusout', applyLater);
    return () => {
      clearTimeout(settle);
      mq.removeEventListener('change', apply);
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      document.removeEventListener('focusin', applyLater);
      document.removeEventListener('focusout', applyLater);
    };
  }, []);
  return open;
}
