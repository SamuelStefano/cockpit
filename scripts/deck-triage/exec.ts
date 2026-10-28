import { spawn } from 'node:child_process';

export interface RunResult { code: number | null; stdout: string; stderr: string; timedOut: boolean }
export type Runner = (cmd: string, args: string[], opts?: { input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv; cwd?: string }) => Promise<RunResult>;

const MAX_OUT = 512 * 1024;

// No shell: argv goes straight to execve, so nothing in it is ever re-parsed.
export const run: Runner = (cmd, args, opts = {}) => new Promise((resolve) => {
  const child = spawn(cmd, args, { env: opts.env ?? process.env, cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, opts.timeoutMs ?? 20_000);
  child.stdout.on('data', (d) => { if (stdout.length < MAX_OUT) stdout += d; });
  child.stderr.on('data', (d) => { if (stderr.length < MAX_OUT) stderr += d; });
  child.on('error', (e) => { clearTimeout(timer); resolve({ code: null, stdout, stderr: stderr + String(e.message), timedOut }); });
  child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
  child.stdin.on('error', () => {});
  child.stdin.end(opts.input ?? '');
});

export interface SshTarget { host: string; keyFile: string }

// The remote script travels on stdin (`bash -s`), never in argv: no quoting layer.
export function ssh(runner: Runner, target: SshTarget, script: string, timeoutMs = 25_000): Promise<RunResult> {
  return runner('ssh', [
    '-i', target.keyFile,
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=8',
    '-o', 'StrictHostKeyChecking=yes',
    target.host,
    'bash -s',
  ], { input: script, timeoutMs });
}

export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([p, new Promise<T>((_, rej) => { timer = setTimeout(() => rej(new Error(`${label}: timeout ${ms}ms`)), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}
