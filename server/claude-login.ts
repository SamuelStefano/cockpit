import { spawn as ptySpawn } from 'node-pty';
import { homedir } from 'node:os';
import type { ClaudeLoginState, ServerMsg } from '../shared/protocol';
import { claudeReady } from './admin-ops';
import { cliPath } from './engine/cli-path';
import { broadcast } from './ws/broadcast';

export interface LoginPty {
  onData: (cb: (data: string) => void) => unknown;
  onExit: (cb: (e: { exitCode: number }) => void) => unknown;
  write: (data: string) => void;
  kill: () => void;
}

export interface ClaudeLoginDeps {
  spawn: () => LoginPty;
  ready: () => boolean;
  emit: (msg: ServerMsg) => void;
  timeoutMs: number;
}

export const LOGIN_TIMEOUT_MS = 10 * 60_000;
export const MAX_CODE_LENGTH = 512;
const MAX_BUFFER = 64 * 1024;

/* eslint-disable no-control-regex */
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const CSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const ESC_OTHER = /\x1b[@-Z\\-_]/g;
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/g;
const CODE_FORBIDDEN = /[\x00-\x1f\x7f]/;
/* eslint-enable no-control-regex */

export function stripTerminal(raw: string): string {
  return raw.replace(OSC, '').replace(CSI, '').replace(ESC_OTHER, '').replace(CONTROL, '');
}

// Only a URL already followed by whitespace counts: a chunk boundary must not yield a truncated link.
export function extractAuthUrl(raw: string): string | null {
  for (const m of stripTerminal(raw).matchAll(/https:\/\/\S+(?=\s)/g)) {
    if (m[0].includes('oauth/authorize')) return m[0];
  }
  return null;
}

export function lastMeaningfulLine(raw: string, secrets: string[] = []): string {
  const lines = stripTerminal(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (/https?:\/\//.test(l) || /^paste code here/i.test(l) || /^opening browser/i.test(l)) continue;
    if (secrets.some((s) => s && l.includes(s))) continue;
    return l.slice(0, 300);
  }
  return '';
}

export function validLoginCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const t = code.trim();
  return t && t.length <= MAX_CODE_LENGTH && !CODE_FORBIDDEN.test(t) ? t : null;
}

export function createClaudeLogin(deps: ClaudeLoginDeps) {
  let session: { pty: LoginPty; timer: ReturnType<typeof setTimeout>; secrets: string[] } | null = null;
  let state: ClaudeLoginState | null = null;

  const set = (next: ClaudeLoginState, extra: { url?: string; error?: string } = {}) => {
    state = next;
    deps.emit({ t: 'claude-login', state: next, ...extra });
  };

  const teardown = () => {
    if (!session) return;
    const s = session;
    session = null;
    clearTimeout(s.timer);
    try { s.pty.kill(); } catch { /* already gone */ }
  };

  const fail = (error: string) => { teardown(); set('error', { error }); };

  function start() {
    teardown();
    set('waiting-url');
    let pty: LoginPty;
    try { pty = deps.spawn(); } catch { fail('Não foi possível iniciar o login do Claude nesta VPS.'); return; }
    const mine = {
      pty,
      secrets: [] as string[],
      timer: setTimeout(() => { if (session === mine) fail('O login expirou. Tente de novo.'); }, deps.timeoutMs),
    };
    session = mine;
    let buf = '';
    let urlSent = false;
    pty.onData((data) => {
      if (session !== mine) return;
      buf = (buf + data).slice(-MAX_BUFFER);
      if (urlSent) return;
      const url = extractAuthUrl(buf);
      if (url) { urlSent = true; set('url', { url }); }
    });
    pty.onExit(({ exitCode }) => {
      if (session !== mine) return;
      clearTimeout(mine.timer);
      session = null;
      if (exitCode === 0 && deps.ready()) {
        set('done');
        deps.emit({ t: 'claude-auth', ready: true });
        return;
      }
      set('error', { error: lastMeaningfulLine(buf, mine.secrets) || 'O login não foi concluído. Tente de novo.' });
    });
  }

  function submitCode(raw: unknown) {
    const code = validLoginCode(raw);
    if (!code || !session || state !== 'url') return;
    session.secrets.push(code);
    set('verifying');
    session.pty.write(code + '\r');
  }

  function cancel() { teardown(); state = null; }

  return { start, submitCode, cancel };
}

function defaultSpawn(): LoginPty {
  const home = process.env.HOME ?? homedir();
  return ptySpawn('claude', ['auth', 'login'], {
    name: 'xterm-256color',
    cols: 2000,
    rows: 24,
    cwd: home,
    env: { PATH: cliPath(), HOME: home, LANG: process.env.LANG ?? 'en_US.UTF-8', TERM: 'xterm-256color', BROWSER: '/bin/false' },
  });
}

export const claudeLogin = createClaudeLogin({
  spawn: defaultSpawn,
  ready: () => claudeReady(),
  emit: broadcast,
  timeoutMs: LOGIN_TIMEOUT_MS,
});
