import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { resolveStaticPath, pipeFile } from './static';

const root = resolve('/srv/dist');

describe('resolveStaticPath', () => {
  it('maps a normal asset path under root', () => {
    expect(resolveStaticPath(root, '/assets/app.js')).toBe(`${root}/assets/app.js`);
  });

  it('serves root itself for /', () => {
    expect(resolveStaticPath(root, '/')).toBe(root);
  });

  it('drops the query string before resolving', () => {
    expect(resolveStaticPath(root, '/index.html?t=123')).toBe(`${root}/index.html`);
  });

  it('neutralizes traversal so it cannot escape root', () => {
    for (const url of ['/../../../etc/passwd', '/a/../../../../etc/shadow', '/%2e%2e%2f%2e%2e%2fetc']) {
      const p = resolveStaticPath(root, url);
      expect(p).not.toBeNull();
      expect(p === root || p!.startsWith(root + '/')).toBe(true);
    }
  });

  it('returns null on malformed percent-encoding instead of throwing', () => {
    expect(resolveStaticPath(root, '/%')).toBeNull();
    expect(resolveStaticPath(root, '/%E0%A4')).toBeNull();
  });
});

function fakeRes() {
  const res = new EventEmitter() as EventEmitter & { destroyed: boolean; destroy: () => void; write: () => boolean; end: () => void };
  res.destroyed = false;
  res.destroy = () => { res.destroyed = true; };
  res.write = () => true;
  res.end = () => {};
  return res;
}

// Sem estes dois listeners o erro de leitura sobe como uncaughtException e o
// backstop do index.ts derruba o backend inteiro por causa de um asset.
describe('pipeFile', () => {
  it('derruba a resposta em vez de lançar quando a leitura falha', async () => {
    const res = fakeRes();
    pipeFile(resolve(root, 'nao-existe.js'), res as unknown as ServerResponse);
    await new Promise((r) => setTimeout(r, 20));
    expect(res.destroyed).toBe(true);
  });

  it('destrói o stream quando o cliente aborta, pra não vazar fd', async () => {
    const res = fakeRes();
    const stream = pipeFile(resolve(__dirname, 'static.ts'), res as unknown as ServerResponse);
    res.emit('close');
    await new Promise((r) => setTimeout(r, 20));
    expect(stream.destroyed).toBe(true);
  });
});
