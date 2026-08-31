import { useState, useEffect } from 'react';

const QUERY = '(max-width: 1023px)';

// O estado inicial LÊ a media query em vez de assumir `false`. Assumindo desktop, o
// celular montava o layout de três painéis inteiro — inclusive o terminal, que puxa
// o chunk do xterm — só pra descartar tudo no primeiro efeito e remontar como mobile.
// Além do flash de layout, isso anulava o code-splitting justamente no aparelho em
// que ele mais importa (o Deck aberto do celular pelo relay).
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return isMobile;
}
