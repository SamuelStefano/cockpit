import type { ToolCall } from '../../../shared/protocol';
import { McpAppFrame } from '../../components/chat/McpAppFrame';

// Espelha o que o fixture MCP (server/mcp/fixture-server.mjs) serve em ui://, pra
// dar pra ver o renderer sem precisar de nenhum servidor MCP configurado.
const DEMO_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root { color-scheme: dark }
  body { margin:0; font:14px system-ui, sans-serif; background:#0d1117; color:#e6edf3;
         padding:16px; display:flex; flex-direction:column; gap:12px }
  h1 { font-size:15px; margin:0; color:#f97316 }
  button { background:#f97316; color:#0d1117; border:0; border-radius:6px;
           padding:8px 14px; font-weight:600; cursor:pointer }
  code { background:#161b22; padding:2px 6px; border-radius:4px }
</style></head>
<body>
  <h1>MCP App rodando dentro do Deck</h1>
  <div>Argumentos recebidos: <code id="args">(aguardando)</code></div>
  <button id="inc">Cliquei <span id="n">0</span>x</button>
  <script>
    let n = 0;
    document.getElementById('inc').addEventListener('click', () => {
      document.getElementById('n').textContent = ++n;
    });
    addEventListener('message', (e) => {
      const m = e.data;
      if (m && m.method === 'ui/notifications/tool-input') {
        document.getElementById('args').textContent = JSON.stringify(m.params?.input ?? {});
      }
    });
    function report() {
      parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/size-changed',
        params: { height: document.documentElement.scrollHeight } }, '*');
    }
    parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*');
    report();
    new ResizeObserver(report).observe(document.body);
  <\/script>
</body></html>`;

const DEMO_TOOL: ToolCall = {
  id: 'demo-mcp-app',
  name: 'mcp__deck-fixture__counter',
  label: 'counter',
  command: '',
  status: 'done',
  output: ['Contador pronto.'],
  appInput: { titulo: 'demonstração' },
  app: { uri: 'ui://deck-fixture/counter.html', html: DEMO_HTML },
};

export function McpAppDemo() {
  return <McpAppFrame tool={DEMO_TOOL} />;
}
