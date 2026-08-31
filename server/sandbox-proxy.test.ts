import { describe, it, expect } from 'vitest';
import { sandboxUpstream, rewriteSetCookie, rewriteLocation, rewriteBody } from './sandbox-proxy';

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
