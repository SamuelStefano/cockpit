import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

// Frames render untrusted HTML with inline scripts, which the app's strict CSP
// forbids (and a srcdoc document inherits it). They load a static host page with
// its own CSP instead (public/sandbox/frame.html, opaque origin) and receive the
// document by postMessage once the host announces itself.
export const SANDBOX_SRC = '/sandbox/frame.html';
export const SANDBOX_FLAGS = 'allow-scripts';

export function useSandboxDoc(ref: RefObject<HTMLIFrameElement | null>, html: string) {
  const [gen, setGen] = useState(0);
  const first = useRef(true);

  // A new document needs a fresh host: the old one already consumed its write.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setGen((g) => g + 1);
  }, [html]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data?.type !== 'deck:host-ready') return;
      // '*' is the only target an opaque origin accepts; the payload is the
      // document this frame is meant to render, nothing from the app.
      ref.current.contentWindow?.postMessage({ type: 'deck:sandbox-doc', html }, '*');
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ref, html]);

  return { src: SANDBOX_SRC, sandbox: SANDBOX_FLAGS, frameKey: gen };
}
