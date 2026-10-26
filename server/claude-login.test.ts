import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClaudeLogin, extractAuthUrl, validLoginCode, type LoginPty } from './claude-login';
import type { ServerMsg } from '../shared/protocol';

const URL_ = 'https://claude.com/cai/oauth/authorize?code=true&client_id=abc&redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&state=xyz';
const SAMPLE =
  'Opening browser to sign in…\r\n' +
  `If the browser didn't open, visit: \x1b]8;;${URL_}\x1b\\${URL_}\x1b]8;;\x1b\\ \x1b[0m\r\n` +
  'Paste code here if prompted > ';

function fakePty() {
  let data: (d: string) => void = () => {};
  let exit: (e: { exitCode: number }) => void = () => {};
  const pty: LoginPty & { written: string[]; killed: boolean } = {
    written: [],
    killed: false,
    onData: (cb) => { data = cb; },
    onExit: (cb) => { exit = cb; },
    write: (d) => { pty.written.push(d); },
    kill: () => { pty.killed = true; },
  };
  return { pty, emitData: (d: string) => data(d), emitExit: (exitCode: number) => exit({ exitCode }) };
}

describe('extractAuthUrl', () => {
  it('reads the url from the real sample with ANSI and OSC 8', () => {
    expect(extractAuthUrl(SAMPLE)).toBe(URL_);
  });
  it('handles BEL-terminated OSC 8', () => {
    expect(extractAuthUrl(`visit: \x1b]8;;${URL_}\x07${URL_}\x1b]8;;\x07\n`)).toBe(URL_);
  });
  it('ignores a url still being streamed', () => {
    expect(extractAuthUrl('visit: https://claude.com/cai/oauth/auth')).toBeNull();
  });
  it('ignores non-oauth links', () => {
    expect(extractAuthUrl('see https://claude.com/docs \n')).toBeNull();
  });
});

describe('validLoginCode', () => {
  it('trims and bounds the code', () => {
    expect(validLoginCode('  abc#def \n')).toBe('abc#def');
    expect(validLoginCode('   ')).toBeNull();
    expect(validLoginCode('a'.repeat(513))).toBeNull();
    expect(validLoginCode(42)).toBeNull();
    expect(validLoginCode('a\rb')).toBeNull();
  });
});

describe('createClaudeLogin', () => {
  let frames: ServerMsg[];
  let ready: boolean;
  let fakes: ReturnType<typeof fakePty>[];
  const make = (timeoutMs = 1000) => createClaudeLogin({
    spawn: () => { const f = fakePty(); fakes.push(f); return f.pty; },
    ready: () => ready,
    emit: (m) => frames.push(m),
    timeoutMs,
  });
  const states = () => frames.filter((f) => f.t === 'claude-login').map((f) => (f as { state: string }).state);

  beforeEach(() => { vi.useFakeTimers(); frames = []; ready = false; fakes = []; });
  afterEach(() => vi.useRealTimers());

  it('emits waiting-url then url', () => {
    const login = make();
    login.start();
    fakes[0].emitData(SAMPLE);
    expect(states()).toEqual(['waiting-url', 'url']);
    expect(frames[1]).toMatchObject({ t: 'claude-login', state: 'url', url: URL_ });
  });

  it('writes the code with CR, goes verifying, then done and claude-auth on success', () => {
    const login = make();
    login.start();
    fakes[0].emitData(SAMPLE);
    login.submitCode('  my-code ');
    expect(fakes[0].pty.written).toEqual(['my-code\r']);
    ready = true;
    fakes[0].emitExit(0);
    expect(states()).toEqual(['waiting-url', 'url', 'verifying', 'done']);
    expect(frames.at(-1)).toEqual({ t: 'claude-auth', ready: true });
  });

  it('a rejected code goes back to url with an error and accepts a retry', () => {
    const login = make();
    login.start();
    fakes[0].emitData(SAMPLE);
    login.submitCode('wrong');
    fakes[0].emitData('Invalid code. Please make sure the full code was copied.\r\n');
    expect(states()).toEqual(['waiting-url', 'url', 'verifying', 'url']);
    expect(frames.at(-1)).toMatchObject({ state: 'url', url: URL_, error: expect.stringContaining('Código inválido') });
    login.submitCode('right');
    expect(fakes[0].pty.written).toEqual(['wrong\r', 'right\r']);
  });

  it('ignores code before the url or when invalid', () => {
    const login = make();
    login.start();
    login.submitCode('early');
    fakes[0].emitData(SAMPLE);
    login.submitCode('   ');
    expect(fakes[0].pty.written).toEqual([]);
  });

  it('nonzero exit gives an error without echoing the code', () => {
    const login = make();
    login.start();
    fakes[0].emitData(SAMPLE);
    login.submitCode('s3cret-code');
    fakes[0].emitData('Error: invalid s3cret-code\r\nOAuth error: Invalid code\r\n');
    fakes[0].emitExit(1);
    const err = frames.at(-1) as { state: string; error: string };
    expect(err.state).toBe('error');
    expect(err.error).toBe('OAuth error: Invalid code');
    expect(JSON.stringify(frames)).not.toContain('s3cret-code');
  });

  it('exit 0 without credentials is an error', () => {
    const login = make();
    login.start();
    fakes[0].emitData(SAMPLE);
    fakes[0].emitExit(0);
    expect(states().at(-1)).toBe('error');
  });

  it('kills and errors after the timeout', () => {
    const login = make(500);
    login.start();
    vi.advanceTimersByTime(501);
    expect(fakes[0].pty.killed).toBe(true);
    expect(states().at(-1)).toBe('error');
  });

  it('start while running restarts cleanly and ignores the old pty', () => {
    const login = make();
    login.start();
    login.start();
    expect(fakes[0].pty.killed).toBe(true);
    fakes[0].emitExit(1);
    fakes[1].emitData(SAMPLE);
    expect(states()).toEqual(['waiting-url', 'waiting-url', 'url']);
  });

  it('cancel kills the process', () => {
    const login = make();
    login.start();
    login.cancel();
    expect(fakes[0].pty.killed).toBe(true);
  });

  it('spawn failure becomes an error', () => {
    const login = createClaudeLogin({ spawn: () => { throw new Error('ENOENT'); }, ready: () => false, emit: (m) => frames.push(m), timeoutMs: 1000 });
    login.start();
    expect(states().at(-1)).toBe('error');
  });
});
