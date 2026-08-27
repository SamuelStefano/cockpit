import { useCallback, useEffect, useState } from 'react';
import { VIEWPORTS } from './viewports';
import { proxiedSandboxUrl, type SandboxTarget } from '../../../../shared/sandbox-preview';

// Só existe depois do redeploy do backend; num backend velho `<slug>.localhost` cai
// no estático e o iframe carregaria o próprio Deck.
function useProxyReady() {
  const [ready, setReady] = useState<boolean | undefined>();
  useEffect(() => {
    let live = true;
    fetch('/healthz')
      .then((r) => r.json())
      .then((h) => { if (live) setReady(!!h.sandboxProxy); })
      .catch(() => { if (live) setReady(false); });
    return () => { live = false; };
  }, []);
  return ready;
}

export function useSandboxPreview(target: SandboxTarget) {
  const [vp, setVp] = useState('fluid');
  const [full, setFull] = useState(false);
  const [nonce, setNonce] = useState(0);
  const proxyReady = useProxyReady();

  // O iframe é de outra origem, então não dá pra mexer no contentWindow.location:
  // recarregar = remontar o elemento trocando a key.
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const proxied = proxyReady ? proxiedSandboxUrl(target, window.location.host) : undefined;
  const width = VIEWPORTS.find((v) => v.id === vp)?.width ?? null;
  return {
    vp, setVp, full, setFull, nonce, reload, width,
    src: proxied ?? target.url,
    proxied: !!proxied,
    probing: proxyReady === undefined,
  };
}
