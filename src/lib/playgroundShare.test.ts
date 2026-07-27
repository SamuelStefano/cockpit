import { describe, it, expect } from 'vitest';
import { encodeShare, decodeShare, buildShareUrl, isShareableLang } from './playgroundShare';

describe('modo in-document', () => {
  it('recusa código do modo App vindo de link', () => {
    expect(decodeShare(encodeShare({ lang: 'app', code: 'fetch("/x")' }))).toBeNull();
    expect(isShareableLang('app')).toBe(false);
  });

  it('não deixa montar um link do modo App', () => {
    expect(() => buildShareUrl('app', 'qualquer')).toThrow();
  });

  it('mantém os runtimes de iframe compartilháveis', () => {
    for (const lang of ['preview', 'preview-html', 'preview-native', 'preview-svg', 'preview-test']) {
      expect(isShareableLang(lang)).toBe(true);
      expect(decodeShare(encodeShare({ lang, code: 'x' }))).not.toBeNull();
    }
  });
});

describe('playgroundShare', () => {
  it('round-trips lang + code', () => {
    const p = { lang: 'preview', code: 'export default () => <div>oi</div>;' };
    expect(decodeShare(encodeShare(p))).toEqual(p);
  });

  it('preserva unicode e quebras de linha', () => {
    const p = { lang: 'preview-native', code: 'const s = "açaí ✓ 日本\\n\ttab";\nreturn s;' };
    expect(decodeShare(encodeShare(p))).toEqual(p);
  });

  it('gera token base64url (sem +/=)', () => {
    const token = encodeShare({ lang: 'preview-svg', code: '<svg/>'.repeat(50) });
    expect(token).not.toMatch(/[+/=]/);
  });

  it('retorna null para token corrompido', () => {
    expect(decodeShare('não-é-base64!!')).toBeNull();
    expect(decodeShare('')).toBeNull();
  });

  it('retorna null quando o JSON não tem os campos esperados', () => {
    expect(decodeShare(btoa('{"x":1}'))).toBeNull();
  });

  it('rejeita token acima do teto sem tentar decodar', () => {
    expect(decodeShare('A'.repeat(256 * 1024 + 1))).toBeNull();
  });

  it('rejeita lang desconhecida: só o que está na allowlist viaja por link', () => {
    const token = encodeShare({ lang: 'inexistente', code: 'x' });
    expect(decodeShare(token)).toBeNull();
  });
});
