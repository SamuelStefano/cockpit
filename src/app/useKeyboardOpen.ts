import { useState, useEffect } from 'react';

// Teclado virtual aberto = viewport visível muito menor que a janela. 0.75 é
// folgado o bastante pra não confundir com a barra de endereço do Safari (que
// come ~10%) e apertado pra pegar qualquer teclado (que come ~40%).
const RATIO = 0.75;
// Com `interactive-widget=resizes-content` (o do index.html) o browser encolhe a
// PRÓPRIA janela ao abrir o teclado: visualViewport.height passa a ser igual a
// innerHeight e a razão acima nunca dispara. A media query curta é o sinal desse
// caso — e também o fallback de quem não tem a API.
const SHORT = '(max-height: 500px)';

export function keyboardOpen(): boolean {
  const short = window.matchMedia(SHORT).matches;
  const vv = window.visualViewport;
  if (!vv) return short;
  return short || vv.height < window.innerHeight * RATIO;
}

// Estado inicial já LÊ o valor (mesmo motivo do useIsMobile): abrir o chat com o
// teclado já aberto não pode passar por um render de layout alto.
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(keyboardOpen);
  useEffect(() => {
    const apply = () => setOpen(keyboardOpen());
    apply();
    const mq = window.matchMedia(SHORT);
    const vv = window.visualViewport;
    mq.addEventListener('change', apply);
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    return () => {
      mq.removeEventListener('change', apply);
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
    };
  }, []);
  return open;
}
