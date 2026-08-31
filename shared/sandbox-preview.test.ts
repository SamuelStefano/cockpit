import { describe, it, expect } from 'vitest';
import { parseSandboxTarget, proxiedSandboxUrl } from './sandbox-preview';

describe('parseSandboxTarget', () => {
  it('lê a url e o host', () => {
    expect(parseSandboxTarget('https://feat-x.preview.devfellowship.com/board\n')).toEqual({
      url: 'https://feat-x.preview.devfellowship.com/board',
      host: 'feat-x.preview.devfellowship.com',
    });
  });

  it('aceita localhost com porta', () => {
    expect(parseSandboxTarget('http://localhost:5173')?.host).toBe('localhost:5173');
  });

  it('ignora comentário e linha vazia antes da url', () => {
    expect(parseSandboxTarget('\n# PR #340\nhttps://a.example.com/')?.host).toBe('a.example.com');
  });

  it('recusa esquema que executa script no iframe', () => {
    expect(parseSandboxTarget('javascript:alert(1)')).toBeUndefined();
    expect(parseSandboxTarget('data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });

  it('recusa corpo vazio ou que não é url', () => {
    expect(parseSandboxTarget('')).toBeUndefined();
    expect(parseSandboxTarget('   \n')).toBeUndefined();
    expect(parseSandboxTarget('feat-x.preview.devfellowship.com')).toBeUndefined();
  });
});

describe('proxiedSandboxUrl', () => {
  const t = (url: string) => parseSandboxTarget(url)!;

  it('serve o preview como subdomínio de localhost, preservando o caminho', () => {
    expect(proxiedSandboxUrl(t('https://feat-x.preview.devfellowship.com/board?a=1#t'), 'localhost:7777'))
      .toBe('http://feat-x.localhost:7777/board?a=1#t');
  });

  it('não proxya host fora do domínio de preview', () => {
    expect(proxiedSandboxUrl(t('https://exemplo.com/'), 'localhost:7777')).toBeUndefined();
    expect(proxiedSandboxUrl(t('https://a.b.preview.devfellowship.com/'), 'localhost:7777')).toBeUndefined();
  });

  it('não proxya quando o Deck não está em localhost', () => {
    const target = t('https://feat-x.preview.devfellowship.com/');
    expect(proxiedSandboxUrl(target, '127.0.0.1:7777')).toBeUndefined();
    expect(proxiedSandboxUrl(target, 'deck.exemplo.com')).toBeUndefined();
  });
});
