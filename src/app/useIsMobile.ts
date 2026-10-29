import { useState, useEffect } from 'react';

// Touch devices up to iPad-landscape width also get the phone layout: three panels plus a
// terminal do not fit a tablet held in hands. `?ui=mobile|desktop` forces either (e2e).
const QUERY = '(max-width: 1023px), (pointer: coarse) and (max-width: 1366px)';

const forced = (): boolean | null => {
  const v = new URLSearchParams(window.location.search).get('ui');
  return v === 'mobile' ? true : v === 'desktop' ? false : null;
};

// O estado inicial LÊ a media query em vez de assumir `false`. Assumindo desktop, o
// celular montava o layout de três painéis inteiro — inclusive o terminal, que puxa
// o chunk do xterm — só pra descartar tudo no primeiro efeito e remontar como mobile.
// Além do flash de layout, isso anulava o code-splitting justamente no aparelho em
// que ele mais importa (o Deck aberto do celular pelo relay).
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => forced() ?? window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setIsMobile(forced() ?? mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return isMobile;
}
