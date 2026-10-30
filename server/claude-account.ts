import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import type { ClaudeAccount } from '../shared/protocol';
import { claudeBin, cliPath } from './engine/cli-path';
import { passthroughEnv } from './claude-login';

const TIMEOUT_MS = 15_000;

export function parseAuthStatus(stdout: string): ClaudeAccount | null {
  let raw: unknown;
  try { raw = JSON.parse(stdout); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.loggedIn !== 'boolean') return null;
  const out: ClaudeAccount = { loggedIn: r.loggedIn };
  if (typeof r.email === 'string') out.email = r.email;
  if (typeof r.orgName === 'string') out.orgName = r.orgName;
  if (typeof r.authMethod === 'string') out.authMethod = r.authMethod;
  return out;
}

function run(args: string[]): Promise<string> {
  const home = process.env.HOME ?? homedir();
  return new Promise((resolve) => {
    execFile(claudeBin(), args, {
      timeout: TIMEOUT_MS,
      cwd: home,
      env: { ...passthroughEnv(), PATH: cliPath(), HOME: home, LANG: process.env.LANG ?? 'en_US.UTF-8' },
    }, (_err, stdout) => resolve(String(stdout ?? '')));
  });
}

export async function readClaudeAccount(): Promise<ClaudeAccount | null> {
  return parseAuthStatus(await run(['auth', 'status']));
}

export async function logoutClaude(): Promise<void> {
  await run(['auth', 'logout']);
}
