import { detachedGroup, killGroup } from '../platform';
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

// Minimal ACP client (Agent Client Protocol, protocolVersion 1): newline-delimited
// JSON-RPC 2.0 over the agent's stdio. The Deck is the "client" side: it calls
// initialize / session/new|load / session/prompt, receives session/update
// notifications and answers the agent's session/request_permission.

export const ACP_PROTOCOL_VERSION = 1;

export interface AcpRpcError { code: number; message: string; data?: unknown }

export class AcpError extends Error {
  constructor(readonly rpc: AcpRpcError) { super(rpc.message); }
}

// ACP reserves -32000 for "authentication required"; agents also phrase it in
// the message, so both are checked.
export function isAuthError(e: unknown): boolean {
  if (!(e instanceof AcpError)) return false;
  return e.rpc.code === -32000 || /auth|log ?in|sign ?in|not authenticated/i.test(e.rpc.message);
}

export interface AcpClientOpts {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onNotification: (method: string, params: any) => void;
  onRequest: (method: string, params: any) => Promise<unknown>;
  onExit: (code: number | null, signal: NodeJS.Signals | null, stderrTail: string) => void;
}

export interface AcpClient {
  child: ChildProcess;
  call: <T = any>(method: string, params: unknown) => Promise<T>;
  notify: (method: string, params: unknown) => void;
  kill: () => void;
}

const STDERR_TAIL = 2000;

export function startAcp(opts: AcpClientOpts): AcpClient {
  const child = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env: opts.env,
    shell: false,
    detached: detachedGroup,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  let stderr = '';
  let closed = false;

  const write = (msg: unknown) => {
    if (closed || !child.stdin?.writable) return;
    child.stdin.write(JSON.stringify(msg) + '\n');
  };

  child.stdin!.on('error', () => {});
  child.stdout!.on('error', () => {});
  child.stderr!.on('error', () => {});
  child.stderr!.on('data', (b: Buffer) => { stderr = (stderr + b.toString('utf8')).slice(-STDERR_TAIL); });

  const rl = createInterface({ input: child.stdout!, crlfDelay: Infinity });
  rl.on('error', () => {});
  rl.on('line', (line) => {
    const s = line.trim();
    if (!s) return;
    let m: any;
    try { m = JSON.parse(s); } catch { return; }
    if (m && typeof m.method === 'string' && m.id !== undefined && m.id !== null) {
      opts.onRequest(m.method, m.params).then(
        (result) => write({ jsonrpc: '2.0', id: m.id, result: result ?? null }),
        (e: Error) => write({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e?.message ?? 'error' } }),
      );
      return;
    }
    if (m && typeof m.method === 'string') { opts.onNotification(m.method, m.params); return; }
    if (m && typeof m.id === 'number' && pending.has(m.id)) {
      const p = pending.get(m.id)!;
      pending.delete(m.id);
      if (m.error) p.reject(new AcpError({ code: Number(m.error.code) || 0, message: String(m.error.message ?? 'erro do agente'), data: m.error.data }));
      else p.resolve(m.result);
    }
  });

  const failAll = (why: string) => {
    for (const p of pending.values()) p.reject(new Error(why));
    pending.clear();
  };
  child.on('error', (e) => { failAll(e.message); });
  child.on('close', (code, signal) => {
    closed = true;
    failAll(`o agente saiu (${signal ?? code})`);
    opts.onExit(code, signal, stderr);
  });

  return {
    child,
    call: (method, params) => new Promise((resolve, reject) => {
      if (closed) { reject(new Error('o agente já saiu')); return; }
      const id = nextId++;
      pending.set(id, { resolve, reject });
      write({ jsonrpc: '2.0', id, method, params });
    }),
    notify: (method, params) => write({ jsonrpc: '2.0', method, params }),
    kill: () => {
      if (closed || child.pid === undefined) return;
      killGroup(child);
    },
  };
}

export const ACP_CLIENT_CAPABILITIES = {
  fs: { readTextFile: false, writeTextFile: false },
  terminal: false,
};
