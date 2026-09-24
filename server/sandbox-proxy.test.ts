import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Captures the upstream https request so each test can play the preview's response.
const upstream = vi.hoisted(() => ({ onResponse: null as null | ((r: unknown) => void), destroyed: false }));
vi.mock('node:https', async () => {
  const { PassThrough: Stream } = await import('node:stream');
  return { request: (_opts: unknown, cb: (r: unknown) => void) => {
    upstream.onResponse = cb;
    upstream.destroyed = false;
    const up = new Stream();
    up.destroy = () => { upstream.destroyed = true; return up; };
    return up;
  } };
});

import {
  sandboxUpstream, rewriteSetCookie, rewriteLocation, rewriteBody,
  sandboxOriginAllowed, proxySandbox, MAX_REWRITE_BYTES,
} from './sandbox-proxy';

describe('sandboxUpstream', () => {
  it('mapeia <slug>.localhost pro host do preview', () => {
    expect(sandboxUpstream('feat-board.localhost:7777')).toBe('feat-board.preview.devfellowship.com');
  });

  it('ignora o host do próprio Deck', () => {
    expect(sandboxUpstream('localhost:7777')).toBeUndefined();
    expect(sandboxUpstream('127.0.0.1:7777')).toBeUndefined();
    expect(sandboxUpstream(undefined)).toBeUndefined();
  });

  it('não vira proxy aberto', () => {
    expect(sandboxUpstream('evil.com')).toBeUndefined();
    expect(sandboxUpstream('evil.com.localhost')).toBeUndefined();
    expect(sandboxUpstream('a.b.localhost')).toBeUndefined();
    expect(sandboxUpstream('-x.localhost')).toBeUndefined();
    expect(sandboxUpstream('..localhost')).toBeUndefined();
  });
});

describe('rewriteSetCookie', () => {
  it('tira Domain e Secure pra o cookie valer no host do proxy', () => {
    expect(rewriteSetCookie(['sb=1; Path=/; Domain=preview.devfellowship.com; Secure; SameSite=Lax']))
      .toEqual(['sb=1; Path=/; SameSite=Lax']);
  });

  it('preserva cookie sem esses atributos', () => {
    expect(rewriteSetCookie(['a=1; Path=/; HttpOnly'])).toEqual(['a=1; Path=/; HttpOnly']);
  });
});

describe('rewriteLocation', () => {
  it('mantém o redirect na origem do proxy', () => {
    expect(rewriteLocation('https://x.preview.devfellowship.com/login?next=/a', 'x.preview.devfellowship.com'))
      .toBe('/login?next=/a');
  });

  it('deixa passar redirect pra fora', () => {
    const google = 'https://accounts.google.com/o/oauth2/auth';
    expect(rewriteLocation(google, 'x.preview.devfellowship.com')).toBe(google);
  });

  it('deixa passar location relativo', () => {
    expect(rewriteLocation('/courses', 'x.preview.devfellowship.com')).toBe('/courses');
  });
});

describe('rewriteBody', () => {
  const up = 'x.preview.devfellowship.com';
  const origin = 'http://x.localhost:7777';

  it('traz a origem embutida pro proxy, inclusive no websocket', () => {
    expect(rewriteBody(`const u="https://${up}/auth/v1";const w="wss://${up}/";`, up, origin))
      .toBe(`const u="http://x.localhost:7777/auth/v1";const w="ws://x.localhost:7777/";`);
  });

  it('não mexe em outras origens', () => {
    const body = 'https://devfellowship.s3.amazonaws.com/a.png';
    expect(rewriteBody(body, up, origin)).toBe(body);
  });
});

describe('sandboxOriginAllowed', () => {
  it('accepts the preview page itself', () => {
    expect(sandboxOriginAllowed('http://x.localhost:7777', 'x.localhost:7777')).toBe(true);
  });

  it('rejects any other browser origin', () => {
    expect(sandboxOriginAllowed('https://evil.com', 'x.localhost:7777')).toBe(false);
    expect(sandboxOriginAllowed('http://localhost:7777', 'x.localhost:7777')).toBe(false);
    expect(sandboxOriginAllowed('http://y.localhost:7777', 'x.localhost:7777')).toBe(false);
  });

  it('lets a non-browser client (no Origin) through', () => {
    expect(sandboxOriginAllowed(undefined, 'x.localhost:7777')).toBe(true);
  });
});

describe('proxySandbox', () => {
  class FakeRes extends EventEmitter {
    headersSent = false;
    status = 0;
    headers: Record<string, unknown> = {};
    private out: Buffer[] = [];
    writeHead(code: number, h: Record<string, unknown>) { this.status = code; this.headers = { ...h }; this.headersSent = true; return this; }
    write(c: Buffer) { this.out.push(Buffer.from(c)); return true; }
    end(c?: Buffer) { if (c) this.out.push(Buffer.from(c)); this.emit('finish'); return this; }
    destroy() { return this; }
    body() { return Buffer.concat(this.out).toString('utf8'); }
  }
  const fakeRes = () => new FakeRes();
  const fakeReq = () => Object.assign(new PassThrough(), { headers: { host: 'x.localhost:7777' }, method: 'GET', url: '/' }) as unknown as IncomingMessage;
  const upstreamRes = (headers: Record<string, string>) => Object.assign(new PassThrough(), { headers, statusCode: 200 });

  beforeEach(() => { upstream.onResponse = null; });

  it('rewrites a small body and sets its length', async () => {
    const res = fakeRes();
    proxySandbox('x.preview.devfellowship.com', fakeReq(), res as unknown as ServerResponse);
    const r = upstreamRes({ 'content-type': 'text/html' });
    upstream.onResponse!(r);
    r.end('<a href="https://x.preview.devfellowship.com/a">');
    await new Promise((d) => setImmediate(d));
    expect(res.body()).toBe('<a href="http://x.localhost:7777/a">');
    expect(res.headers['content-length']).toBe(String(Buffer.byteLength(res.body())));
  });

  it('streams a body past the cap instead of holding it whole', async () => {
    const res = fakeRes();
    proxySandbox('x.preview.devfellowship.com', fakeReq(), res as unknown as ServerResponse);
    const r = upstreamRes({ 'content-type': 'application/json' });
    upstream.onResponse!(r);
    r.write(Buffer.alloc(MAX_REWRITE_BYTES + 1, 'a'));
    await new Promise((d) => setImmediate(d));
    expect(res.headersSent).toBe(true);
    expect(res.headers['content-length']).toBeUndefined();
  });

  it('destroys the upstream request when the client goes away', () => {
    const res = fakeRes();
    proxySandbox('x.preview.devfellowship.com', fakeReq(), res as unknown as ServerResponse);
    res.emit('close');
    expect(upstream.destroyed).toBe(true);
  });

  it('does not throw when the upstream response errors after an abort', () => {
    const res = fakeRes();
    proxySandbox('x.preview.devfellowship.com', fakeReq(), res as unknown as ServerResponse);
    const r = upstreamRes({ 'content-type': 'text/html' });
    upstream.onResponse!(r);
    expect(() => r.emit('error', Object.assign(new Error('aborted'), { code: 'ECONNRESET' }))).not.toThrow();
  });
});
