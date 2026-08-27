import { describe, it, expect } from 'vitest';
import { parseSandboxTarget } from './sandbox-preview';

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
