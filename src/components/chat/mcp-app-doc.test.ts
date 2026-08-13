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
