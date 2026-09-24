import { describe, it, expect } from 'vitest';
import { mcpAppCsp, mcpAppDoc } from './mcp-app-doc';

describe('mcpAppCsp', () => {
  it('nega rede por padrão', () => {
    const csp = mcpAppCsp();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("frame-src 'none'");
  });

  it('libera só os domínios declarados pelo app', () => {
    const csp = mcpAppCsp({ connectDomains: ['https://api.exemplo.com'] });
    expect(csp).toContain('connect-src https://api.exemplo.com');
  });

  it('descarta domínio não-https ou com injeção de diretiva', () => {
    const csp = mcpAppCsp({ connectDomains: ['http://inseguro.com', "https://x.com; script-src *", 'javascript:alert(1)'] });
    expect(csp).toContain("connect-src 'none'");
    expect(csp).not.toContain('script-src *');
  });

  it('mantém data:/blob: para imagem mesmo sem domínio declarado', () => {
    expect(mcpAppCsp()).toContain('img-src data: blob:');
  });

  it('não libera eval — app auto-contido não precisa', () => {
    expect(mcpAppCsp()).not.toContain('unsafe-eval');
  });
});

describe('mcpAppDoc', () => {
  it('injeta a CSP como primeiro item do head', () => {
    const doc = mcpAppDoc('<html><head><title>x</title></head><body>oi</body></html>');
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<title>'));
  });

  it('cria head quando o documento não tem', () => {
    expect(mcpAppDoc('<html><body>oi</body></html>')).toContain('<head><meta http-equiv="Content-Security-Policy"');
  });

  it('cobre fragmento sem html nem head', () => {
    expect(mcpAppDoc('<div>oi</div>')).toContain('Content-Security-Policy');
  });

  it('escapa aspas para não quebrar o atributo content', () => {
    const doc = mcpAppDoc('<html><head></head></html>', { connectDomains: ['https://a.com'] });
    const attr = doc.slice(doc.indexOf('content="') + 9, doc.indexOf('">', doc.indexOf('content="')));
    expect(attr).not.toContain('"');
  });
});

describe('mcpAppDoc', () => {
  it('puts the CSP in <head>, not in a <header> that comes first', () => {
    const doc = mcpAppDoc('<html><body><header>x</header><script>1</script></body></html>');
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<header>'));
    expect(doc).toMatch(/^<html><head><meta http-equiv="Content-Security-Policy"/);
  });
});

describe('mcpAppDoc with content before <head>', () => {
  const policyFirst = (doc: string) => {
    const p = doc.indexOf('Content-Security-Policy');
    const script = doc.indexOf('<script');
    expect(p).toBeGreaterThan(-1);
    expect(p).toBeLessThan(script);
    const before = doc.slice(0, p);
    expect(before.lastIndexOf('<!--')).toBeLessThanOrEqual(before.lastIndexOf('-->'));
  };

  it('puts the policy before a script that precedes <head>', () => {
    policyFirst(mcpAppDoc("<script>fetch('https://x/')</script><head></head><body></body>"));
  });

  it('ignores a <head> inside an earlier comment', () => {
    policyFirst(mcpAppDoc('<!-- <head> --><script>1</script><html><head></head></html>'));
  });

  it('keeps the doctype first so the app stays in standards mode', () => {
    const doc = mcpAppDoc('<!doctype html><script>1</script><head></head>');
    expect(doc.startsWith('<!doctype html><head><meta')).toBe(true);
  });

  it('still uses the real <head> after a doctype, comment and <html>', () => {
    const doc = mcpAppDoc('<!DOCTYPE html>\n<!-- app --><html lang="en"><head><title>x</title></head></html>');
    expect(doc).toContain('<html lang="en"><head><meta http-equiv="Content-Security-Policy"');
  });
});
