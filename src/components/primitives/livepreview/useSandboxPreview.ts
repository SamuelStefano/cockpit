import { useCallback, useState } from 'react';
import { VIEWPORTS } from './viewports';

export function useSandboxPreview() {
  const [vp, setVp] = useState('fluid');
  const [full, setFull] = useState(false);
  const [nonce, setNonce] = useState(0);

  // O iframe é de outra origem, então não dá pra mexer no contentWindow.location:
  // recarregar = remontar o elemento trocando a key.
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const width = VIEWPORTS.find((v) => v.id === vp)?.width ?? null;
  return { vp, setVp, full, setFull, nonce, reload, width };
}
