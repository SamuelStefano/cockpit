import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

// Windows differences in one place, so the callers keep reading as POSIX code.
export const IS_WINDOWS = process.platform === 'win32';

// Node on Windows has no HOME, and half of the server reads it. Runs before any app
// module does (agent.ts), so those reads see the profile dir.
export function ensureHome(env: NodeJS.ProcessEnv = process.env, windows = IS_WINDOWS): void {
  if (windows && !env.HOME) env.HOME = homedir();
}

// Without these a Windows child dies before main (SystemRoot) or cannot find its own
// profile, credentials and temp dir. The server builds minimal envs by allow-list.
const WINDOWS_ENV = [
  'SystemRoot', 'SystemDrive', 'windir', 'ComSpec', 'PATHEXT', 'USERPROFILE', 'USERNAME', 'USERDOMAIN',
  'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)',
  'ProgramW6432', 'TEMP', 'TMP', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'CLAUDE_CODE_GIT_BASH_PATH',
];

export function platformEnv(source: NodeJS.ProcessEnv = process.env, windows = IS_WINDOWS): Record<string, string> {
  if (!windows) return {};
  const out: Record<string, string> = {};
  for (const k of WINDOWS_ENV) if (source[k]) out[k] = source[k] as string;
  return out;
}

// Windows has no process groups: `detached` only opens a new console there.
export const detachedGroup = !IS_WINDOWS;

// Stops the child and everything under it. POSIX signals the group the child leads
// (spawned with `detached`); Windows has no signals, so taskkill walks the tree.
export function killGroup(child: Pick<ChildProcess, 'pid' | 'kill'>, signal: NodeJS.Signals = 'SIGKILL'): void {
  const pid = child.pid;
  if (!pid) return;
  if (IS_WINDOWS) {
    const p = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    p.on('error', () => { try { child.kill(); } catch { /* already gone */ } });
    return;
  }
  try { process.kill(-pid, signal); } catch { try { child.kill(signal); } catch { /* already gone */ } }
}

// Node refuses to run .cmd shims without a shell, and a shell would parse the args.
// npm is a plain script, so run it with the node that is running us.
export function npmInvocation(cmd: string, args: string[], execPath = process.execPath, windows = IS_WINDOWS, exists: (p: string) => boolean = existsSync): [string, string[]] {
  if (!windows || basename(cmd) !== 'npm') return [cmd, args];
  const cli = join(dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return exists(cli) ? [execPath, [cli, ...args]] : [cmd, args];
}
