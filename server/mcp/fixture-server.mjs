#!/usr/bin/env node
// Servidor MCP stdio mínimo que expõe UMA tool com UI (SEP-1865). Serve de prova
// end-to-end do Deck como host de MCP Apps, sem depender de nenhum MCP externo.
// Registrar em ~/.claude.json como { "deck-fixture": { "command": "node",
// "args": ["<repo>/server/mcp/fixture-server.mjs"] } }.

const UI_URI = 'ui://deck-fixture/counter.html';
const MIME = 'text/html;profile=mcp-app';

const HTML = `<!doctype html>
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
    const btn = document.getElementById('inc');
    btn.addEventListener('click', () => { document.getElementById('n').textContent = ++n; });
    addEventListener('message', (e) => {
      const m = e.data;
      if (m && m.method === 'ui/notifications/tool-input') {
        document.getElementById('args').textContent = JSON.stringify(m.params?.input ?? {});
      }
    });
    parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*');
  </script>
</body></html>`;

const TOOLS = [{
  name: 'counter',
  description: 'Demonstra um MCP App renderizado pelo Deck.',
  inputSchema: { type: 'object', properties: { titulo: { type: 'string' } }, additionalProperties: false },
  _meta: { ui: { resourceUri: UI_URI, visibility: ['model', 'app'] } },
}];

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });

function handle(req) {
  const { id, method, params } = req;
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {}, resources: {}, extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [MIME] } } },
        serverInfo: { name: 'deck-fixture', version: '1.0.0' },
      });
    case 'tools/list':
      return reply(id, { tools: TOOLS });
    case 'resources/list':
      return reply(id, { resources: [{ uri: UI_URI, name: 'contador', mimeType: MIME }] });
    case 'resources/read':
      return reply(id, { contents: [{ uri: UI_URI, mimeType: MIME, text: HTML }] });
    case 'tools/call':
      return reply(id, {
        content: [{ type: 'text', text: 'Contador pronto.' }],
        structuredContent: { ok: true, titulo: params?.arguments?.titulo ?? null },
        _meta: { ui: { resourceUri: UI_URI } },
      });
    case 'ping':
      return reply(id, {});
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `sem método: ${method}` } });
  }
}

let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch { /* linha inválida */ }
  }
});
