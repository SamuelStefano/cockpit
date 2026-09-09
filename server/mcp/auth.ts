import { tokenAllowed } from '../ws/token';

// Gate da rota MCP. Separado de serve.ts (que arrasta o SDK e as tools) pra ser
// testável isolado — é o único ponto entre a rede e o histórico do dono.

export const MCP_PATH = '/mcp';

export function bearerToken(header: string | undefined): string {
  if (!header) return '';
  const m = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
  return m ? m[1] : '';
}

// Qual segredo governa a rota. COCKPIT_MCP_TOKEN quando existe; senão o do WS,
// pra não quebrar quem já configurou. Separado do `mcpAuthorized` porque a
// escolha é a parte que importa auditar.
export function mcpSecret(wsToken: string, mcpToken: string): string {
  return mcpToken || wsToken;
}

// Default-DENY, ao contrário do gate do WS: tokenAllowed() libera quando não há
// token configurado porque o WS nasceu loopback-only. Esta rota existe pra ser
// alcançada de FORA da box (Tailscale), então sem token ela não abre — senão
// quem chegasse na porta leria o histórico inteiro sem apresentar nada.
export function mcpAuthorized(expected: string, header: string | undefined): boolean {
  if (!expected) return false;
  return tokenAllowed(expected, bearerToken(header));
}

// Compara só o path: com querystring o cliente cairia no static e receberia o
// index.html da SPA no lugar de JSON-RPC.
export function isMcpPath(url: string | undefined): boolean {
  if (!url) return false;
  return url.split('?')[0] === MCP_PATH;
}
