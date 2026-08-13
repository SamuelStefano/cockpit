import { useEffect, useMemo, useRef, useState } from 'react';
import type { ToolCall } from '../../../shared/protocol';
import { mcpAppDoc } from './mcp-app-doc';

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 720;

// Ponte host<->view do SEP-1865, no subconjunto que o Deck consegue honrar.
// O iframe roda em origem opaca (sem allow-same-origin), então `event.origin` é
// sempre "null" e não serve de autenticação — a identidade vem de comparar
// `event.source` com o contentWindow deste iframe específico.
export function useMcpApp(tool: ToolCall) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [ready, setReady] = useState(false);

  const srcDoc = useMemo(() => (tool.app ? mcpAppDoc(tool.app.html, tool.app.csp) : ''), [tool.app]);

  // Entregar de novo a cada mudança de status: o app é montado enquanto a tool
  // ainda roda e precisa saber quando o resultado chegou.
  const input = tool.appInput;
  const output = tool.output;
  const status = tool.status;

  useEffect(() => {
    function post(method: string, params: unknown) {
      // targetOrigin '*' é o único alcançável numa origem opaca. Só trafega o que
      // já pertence a esta tool — nada de estado do Deck.
      ref.current?.contentWindow?.postMessage({ jsonrpc: '2.0', method, params }, '*');
    }

    function onMessage(e: MessageEvent) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      const { method, params } = msg as { method?: string; params?: Record<string, unknown> };
      if (method === 'ui/notifications/initialized') {
        setReady(true);
        post('ui/notifications/tool-input', { input: input ?? {} });
        if (status !== 'running') post('ui/notifications/tool-result', { output, status });
        return;
      }
      if (method === 'ui/notifications/size-changed') {
        const h = Number(params?.height);
        if (Number.isFinite(h) && h > 0) setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(h))));
      }
    }

    addEventListener('message', onMessage);
    return () => removeEventListener('message', onMessage);
  }, [input, output, status]);

  // O resultado pode chegar depois do handshake — reenvia quando a tool fecha.
  useEffect(() => {
    if (!ready || status === 'running') return;
    ref.current?.contentWindow?.postMessage(
      { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { output, status } },
      '*',
    );
  }, [ready, status, output]);

  return { ref, srcDoc, height, ready };
}
