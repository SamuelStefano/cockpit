import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { resolveStaticPath } from './static';

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
