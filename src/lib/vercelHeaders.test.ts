import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import config from '../../vercel.json';

type Rule = { source: string; headers: { key: string; value: string }[] };
const rules = config.headers as Rule[];
const value = (r: Rule, key: string) => r.headers.find((h) => h.key === key)?.value ?? '';

describe('vercel.json headers', () => {
  const app = rules.find((r) => r.source === '/((?!sandbox/).*)')!;
  const sandboxIdx = rules.findIndex((r) => r.source === '/sandbox/(.*)');

  it('keeps the strict CSP on the app', () => {
    const csp = value(app, 'Content-Security-Policy');
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    expect(csp).toMatch(/frame-src 'self'/);
  });

  it('overrides the CSP for /sandbox/* and comes after the catch-all', () => {
    expect(sandboxIdx).toBeGreaterThan(rules.indexOf(app));
    const csp = value(rules[sandboxIdx], 'Content-Security-Policy');
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(value(rules[sandboxIdx], 'X-Frame-Options')).toBe('SAMEORIGIN');
  });
});

describe('vercel.json static pages', () => {
  const rewrites = config.rewrites as { source: string; destination: string }[];
  const catchAll = rewrites.findIndex((r) => r.source === '/(.*)');

  it('serves the store pages before the SPA catch-all', () => {
    const page = rewrites.findIndex((r) => r.destination === '/$1/index.html');
    expect(page).toBeGreaterThanOrEqual(0);
    expect(page).toBeLessThan(catchAll);
    for (const slug of ['privacy', 'support', 'terms']) {
      expect(new RegExp(`^${rewrites[page].source}$`).test(`/${slug}`)).toBe(true);
    }
  });

  it('ships the pages as real HTML with no script (the CSP forbids inline script)', () => {
    for (const slug of ['privacy', 'support', 'terms']) {
      const html = readFileSync(resolve(__dirname, `../../public/${slug}/index.html`), 'utf8');
      expect(html).toMatch(/<h1>/);
      expect(html).toContain('tainan@devfellowship.com');
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/\son[a-z]+=/i);
    }
  });
});
