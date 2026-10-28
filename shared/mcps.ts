// `claude mcp list` parsing and the login command. Pure, no node:* import: the
// server and the UI share it.

export type McpStatus = 'connected' | 'needs-auth' | 'failed';

export interface McpServer {
  name: string;
  target: string;
  status: McpStatus;
  detail?: string;
}

export interface McpsState {
  servers: McpServer[];
  // Set when `claude mcp list` could not run: the list is then unknown.
  error?: string;
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const LINE_RE = /^(.+?): (.+?) - (✔|!|✘|⚠)\s*(.*)$/;

// Lines look like `name: https://host/mcp (HTTP) - ✔ Connected`. The name may
// itself contain ": " ("claude.ai Claude Docs"), hence the lazy first group.
export function parseMcpList(output: string): McpServer[] {
  const out: McpServer[] = [];
  for (const line of output.replace(ANSI_RE, '').split(/\r?\n/)) {
    const m = LINE_RE.exec(line.trim());
    if (!m) continue;
    const [, name, rawTarget, mark, text] = m;
    const target = rawTarget.replace(/\s+\((?:HTTP|SSE|stdio)\)$/i, '');
    const status = mark === '✔' ? 'connected' : /auth/i.test(text) ? 'needs-auth' : 'failed';
    out.push({ name, target, status, detail: status === 'connected' ? undefined : text || undefined });
  }
  return out;
}

// What the "Entrar" button types into the terminal. `name` comes from the server
// state, but is re-checked: it ends up on a shell line.
export function loginCommand(name: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(name) ? `claude mcp login ${name}` : null;
}
