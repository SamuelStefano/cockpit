import { useCallback, useState } from 'react';
import { VIEWPORTS } from './viewports';
import { proxiedSandboxUrl, type SandboxTarget } from '../../../../shared/sandbox-preview';

export function useSandboxPreview(target: SandboxTarget) {
  const [vp, setVp] = useState('fluid');
  const [full, setFull] = useState(false);
  const [nonce, setNonce] = useState(0);

  // O iframe é de outra origem, então não dá pra mexer no contentWindow.location:
  // recarregar = remontar o elemento trocando a key.
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const proxied = proxiedSandboxUrl(target, window.location.host);
  const width = VIEWPORTS.find((v) => v.id === vp)?.width ?? null;
  return { vp, setVp, full, setFull, nonce, reload, width, src: proxied ?? target.url, proxied: !!proxied };
}
