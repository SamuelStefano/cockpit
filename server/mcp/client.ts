import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { managedEnvSync, mcpServerDefsSync } from '../admin-ops';

// Definição de um server no ~/.claude.json. Duas formas: processo local (command)
// ou endpoint remoto (url + headers).
interface StdioDef { command: string; args?: string[]; env?: Record<string, string> }
interface HttpDef { url: string; headers?: Record<string, string> }

function isStdio(d: unknown): d is StdioDef {
  return !!d && typeof (d as StdioDef).command === 'string';
}
function isHttp(d: unknown): d is HttpDef {
  return !!d && typeof (d as HttpDef).url === 'string';
}

// O `claude -p` herda todo o ambiente ao subir um MCP stdio; aqui montamos um env
// mínimo + o env gerenciado do Deck, pra não vazar segredo do processo do backend
// para um server que só precisa falar JSON-RPC.
function stdioEnv(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {};
  for (const k of ['PATH', 'HOME', 'LANG', 'TMPDIR']) {
    const v = process.env[k];
    if (v) base[k] = v;
  }
  return { ...base, ...managedEnvSync(), ...(extra ?? {}) };
}

function transportFor(def: unknown): Transport | undefined {
  if (isStdio(def)) {
    return new StdioClientTransport({
      command: def.command,
      args: def.args ?? [],
      env: stdioEnv(def.env),
      stderr: 'ignore',
    });
  }
  if (isHttp(def)) {
    return new StreamableHTTPClientTransport(new URL(def.url), {
      requestInit: { headers: def.headers ?? {} },
    });
  }
  return undefined;
}

export interface McpSession {
  client: Client;
  close: () => Promise<void>;
}

// Abre uma sessão MCP contra um server declarado no ~/.claude.json. Usada só para
// leitura (tools/list, resources/read) — nunca para tools/call, porque a tool já
// foi executada pelo `claude -p` e repetir teria efeito colateral.
export async function openSession(server: string): Promise<McpSession | undefined> {
  const def = mcpServerDefsSync()[server];
  if (!def) return undefined;
  const transport = transportFor(def);
  if (!transport) return undefined;

  const client = new Client({ name: 'deck-mcp-apps', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
  } catch {
    try { await transport.close(); } catch { /* transporte já morto */ }
    return undefined;
  }
  return {
    client,
    close: async () => { try { await client.close(); } catch { /* já fechado */ } },
  };
}
