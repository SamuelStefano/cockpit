import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { minimalEnv } from '../engine/claude';
import { cliPath } from '../engine/cli-path';
import { recordIncident } from './incidents';

// Every `claude -p` refreshes the OAuth token on its own when it finds it expired.
// With several turns/crons/one-shots spawning at the expiry minute, they race on the
// rotating refresh token: one wins, the others get "OAuth session expired and could
// not be refreshed", and the queue kept firing prompts into a dead login.

const CRED_PATH = join(homedir(), '.claude', '.credentials.json');
const AUTH_TEXT = /OAuth session expired|could not be refreshed|Failed to authenticate|authentication_error|OAuth token has expired|Please run \/login|Invalid bearer token/i;
// The CLI bails with one short line; a real answer ABOUT auth is much longer.
const AUTH_BAIL_MAX_CHARS = 400;
// Refresh ahead of expiry with a single process, so concurrent turns never see an
// expired token and never race on the refresh.
export const REFRESH_LEAD_MS = 45 * 60_000;
const KEEPALIVE_TIMEOUT_MS = 90_000;

export const AUTH_MESSAGE = 'O login do Claude nesta box expirou e não renovou sozinho. Rode `claude /login` num terminal da box e reenvie — a fila fica segurada até o login voltar.';

export function isAuthFailure(text: string): boolean {
  const t = text.trim();
  return t !== '' && t.length <= AUTH_BAIL_MAX_CHARS && AUTH_TEXT.test(t);
}

// Broken until the credentials file is rewritten after the failure (a new /login).
export function authHoldFrom(brokenAt: number, credMtimeMs: number): boolean {
  return brokenAt > 0 && credMtimeMs <= brokenAt;
}

export function refreshDue(expiresAt: number, now: number): boolean {
  return expiresAt > 0 && expiresAt - now < REFRESH_LEAD_MS;
}

let brokenAt = 0;

function credMtime(): number {
  try { return statSync(CRED_PATH).mtimeMs; } catch { return 0; }
}

function readExpiresAt(): number {
  try {
    const exp = JSON.parse(readFileSync(CRED_PATH, 'utf8'))?.claudeAiOauth?.expiresAt;
    return typeof exp === 'number' ? exp : 0;
  } catch { return 0; }
}

export function markAuthBroken(sessionKey: string, now = Date.now()): void {
  if (brokenAt) return;
  brokenAt = now;
  recordIncident({ kind: 'auth-expired', sessionKey, detail: 'OAuth do CLI expirou e o refresh falhou; precisa de /login' });
}

export function authHold(): boolean {
  if (!brokenAt) return false;
  if (authHoldFrom(brokenAt, credMtime())) return true;
  brokenAt = 0;
  return false;
}

let inflight = false;

function keepAliveTick(): void {
  if (inflight || authHold() || !refreshDue(readExpiresAt(), Date.now())) return;
  inflight = true;
  const args = ['-p', 'ok', '--model', 'haiku', '--effort', 'low', '--max-turns', '1', '--permission-mode', 'plan', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json'];
  let out = '';
  let child;
  try {
    child = spawn('claude', args, { cwd: tmpdir(), env: { ...minimalEnv(), PATH: cliPath() }, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { inflight = false; return; }
  const collect = (d: Buffer) => { out = (out + String(d)).slice(-4096); };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);
  const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already gone */ } }, KEEPALIVE_TIMEOUT_MS);
  const done = () => {
    clearTimeout(timer);
    inflight = false;
    if (AUTH_TEXT.test(out)) markAuthBroken('auth-keepalive');
  };
  child.on('error', done);
  child.on('close', done);
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startAuthKeepAlive(intervalMs = 5 * 60_000): void {
  if (timer) return;
  timer = setInterval(keepAliveTick, intervalMs);
  timer.unref?.();
  setTimeout(keepAliveTick, 20_000).unref?.();
}
