import { describe, it, expect } from 'vitest';
import config from '../../vercel.json';

type Rule = { source: string; headers: { key: string; value: string }[] };
const rules = config.headers as Rule[];
const value = (r: Rule, key: string) => r.headers.find((h) => h.key === key)?.value ?? '';

describe('vercel.json headers', () => {
  const app = rules.find((r) => r.source === '/(.*)')!;
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
