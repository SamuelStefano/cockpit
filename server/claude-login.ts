import { spawn as ptySpawn } from 'node-pty';
import { homedir } from 'node:os';
import type { ClaudeLoginState, ServerMsg } from '../shared/protocol';
import { claudeReady } from './admin-ops';
import { cliPath } from './engine/cli-path';
import { broadcast } from './ws/broadcast';
import { readClaudeAccount } from './claude-account';

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
  urlTimeoutMs?: number;
  verifyTimeoutMs?: number;
}

export const LOGIN_TIMEOUT_MS = 10 * 60_000;
export const URL_TIMEOUT_MS = 30_000;
export const VERIFY_TIMEOUT_MS = 60_000;
export const SHELL_HINT = 'Abra a aba Shell e rode `claude auth login`.';
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
  type Session = { pty: LoginPty; timer: ReturnType<typeof setTimeout>; phase?: ReturnType<typeof setTimeout>; secrets: string[] };
  let session: Session | null = null;
  const urlTimeoutMs = deps.urlTimeoutMs ?? URL_TIMEOUT_MS;
  const verifyTimeoutMs = deps.verifyTimeoutMs ?? VERIFY_TIMEOUT_MS;
  let state: ClaudeLoginState | null = null;
  let lastUrl: string | null = null;

  const set = (next: ClaudeLoginState, extra: { url?: string; error?: string } = {}) => {
    state = next;
    deps.emit({ t: 'claude-login', state: next, ...extra });
  };

  const teardown = () => {
    if (!session) return;
    const s = session;
    session = null;
    clearTimeout(s.timer);
    clearTimeout(s.phase);
    try { s.pty.kill(); } catch { /* already gone */ }
  };

  const fail = (error: string) => { teardown(); set('error', { error }); };

  function start() {
    teardown();
    lastUrl = null;
    set('waiting-url');
    let pty: LoginPty;
    try { pty = deps.spawn(); } catch (e) {
      const why = String((e as Error)?.message ?? e).split('\n')[0].slice(0, 160);
      fail(`Não foi possível iniciar o \`claude\` nesta VPS${why ? ` (${why})` : ''}. ${SHELL_HINT}`);
      return;
    }
    const mine: Session = {
      pty,
      secrets: [],
      timer: setTimeout(() => { if (session === mine) fail(`O login expirou. Tente de novo. ${SHELL_HINT}`); }, deps.timeoutMs),
    };
    // The CLI can hang without printing a link (no network, first-run prompt): never spin forever.
    mine.phase = setTimeout(() => {
      if (session === mine && state === 'waiting-url') fail(`O Claude não mostrou o link de login. ${SHELL_HINT}`);
    }, urlTimeoutMs);
    session = mine;
    let buf = '';
    let url: string | null = null;
    pty.onData((data) => {
      if (session !== mine) return;
      buf = (buf + data).slice(-MAX_BUFFER);
      // A wrong code doesn't exit the CLI: it prints this and keeps waiting at the prompt.
      if (state === 'verifying' && url && /invalid code/i.test(stripTerminal(data))) {
        clearTimeout(mine.phase);
        set('url', { url, error: 'Código inválido. Copie o código inteiro e cole de novo.' });
        return;
      }
      if (url) return;
      url = extractAuthUrl(buf);
      if (url) { lastUrl = url; clearTimeout(mine.phase); set('url', { url }); }
    });
    pty.onExit(({ exitCode }) => {
      if (session !== mine) return;
      clearTimeout(mine.timer);
      clearTimeout(mine.phase);
      session = null;
      if (exitCode === 0 && deps.ready()) {
        set('done');
        deps.emit({ t: 'claude-auth', ready: true });
        return;
      }
      set('error', { error: lastMeaningfulLine(buf, mine.secrets) || `O login não foi concluído. ${SHELL_HINT}` });
    });
  }

  function submitCode(raw: unknown) {
    const code = validLoginCode(raw);
    if (!code || !session || state !== 'url') return;
    session.secrets.push(code);
    set('verifying');
    const mine = session;
    clearTimeout(mine.phase);
    // The CLI keeps waiting at the prompt on a network error: hand the retry back instead of spinning.
    mine.phase = setTimeout(() => {
      if (session !== mine || state !== 'verifying') return;
      const link = lastUrl;
      if (link) set('url', { url: link, error: `A Anthropic não respondeu ao código. Tente de novo ou ${SHELL_HINT.toLowerCase()}` });
      else fail(`A Anthropic não respondeu ao código. ${SHELL_HINT}`);
    }, verifyTimeoutMs);
    mine.pty.write(code + '\r');
  }

  function cancel() { teardown(); state = null; }

  return { start, submitCode, cancel };
}

// Proxy and CA settings: without them the CLI cannot reach Anthropic from behind a corporate network.
const PASSTHROUGH = ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'USER', 'LOGNAME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME'];

export function passthroughEnv(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of PASSTHROUGH) if (source[k]) out[k] = source[k] as string;
  return out;
}

function defaultSpawn(): LoginPty {
  const home = process.env.HOME ?? homedir();
  return ptySpawn('claude', ['auth', 'login'], {
    name: 'xterm-256color',
    cols: 2000,
    rows: 24,
    cwd: home,
    env: { ...passthroughEnv(), PATH: cliPath(), HOME: home, LANG: process.env.LANG ?? 'en_US.UTF-8', TERM: 'xterm-256color', BROWSER: '/bin/false' },
  });
}

export const claudeLogin = createClaudeLogin({
  spawn: defaultSpawn,
  ready: () => claudeReady(),
  emit: (msg) => {
    broadcast(msg);
    if (msg.t === 'claude-auth' && msg.ready) void readClaudeAccount().then((account) => broadcast({ t: 'claude-account', account }));
  },
  timeoutMs: LOGIN_TIMEOUT_MS,
});
