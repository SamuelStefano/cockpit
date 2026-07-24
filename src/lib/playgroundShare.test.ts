import { describe, it, expect } from 'vitest';
import { encodeShare, decodeShare } from './playgroundShare';

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

  it('decoda mesmo com lang desconhecida (validação de lang é na rota)', () => {
    const token = encodeShare({ lang: 'inexistente', code: 'x' });
    expect(decodeShare(token)).toEqual({ lang: 'inexistente', code: 'x' });
  });
});
