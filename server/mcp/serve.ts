import type { IncomingMessage, ServerResponse } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CONFIG } from '../config';
import { mcpAuthorized } from './auth';
import { MCP_TOOLS } from './format';
import { runTool } from './tools';

// O Deck já era CLIENTE MCP (mcp/client.ts, pra inspecionar os servers do
// ~/.claude.json). Aqui ele vira SERVIDOR: um agente de fora (Cursor na máquina
// do dono, via Tailscale) fala JSON-RPC nesta rota e lê os contextos e sessões
// que só existem nesta box — sem copiar arquivo pra lugar nenhum.

export { MCP_PATH, isMcpPath } from './auth';

export function createMcpServer(): Server {
  const server = new Server({ name: 'deck', version: '1.0.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }));

  // Falha de tool volta como isError (texto que o modelo lê), não como exceção de
  // protocolo: "contexto não encontrado" é resposta legítima, e derrubar o
  // JSON-RPC obrigaria o cliente a reconectar por causa de um id errado.
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const text = await runTool(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>);
      return { content: [{ type: 'text' as const, text }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true };
    }
  });

  return server;
}

export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!mcpAuthorized(CONFIG.authToken, req.headers.authorization)) {
    const reason = CONFIG.authToken ? 'token inválido' : 'COCKPIT_TOKEN não configurado no servidor';
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: reason }));
    return;
  }

  // Stateless (sessionIdGenerator undefined): cada request monta seu par
  // server+transport e morre junto com a resposta. Sem sessão pendurada pra
  // expirar nem estado compartilhado entre clientes — e o custo é irrelevante
  // porque toda tool aqui é leitura de disco.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}
