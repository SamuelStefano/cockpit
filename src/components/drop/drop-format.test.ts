import { describe, it, expect } from 'vitest';
import { fmtDropBytes, shortSha, slugFromName } from './drop-format';

describe('drop-format', () => {
  it('formata bytes na escala de um .env', () => {
    expect(fmtDropBytes(0)).toBe('0 B');
    expect(fmtDropBytes(42)).toBe('42 B');
    expect(fmtDropBytes(1536)).toBe('1.5 KB');
    expect(fmtDropBytes(40_960)).toBe('40 KB');
    expect(fmtDropBytes(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(fmtDropBytes(NaN)).toBe('0 B');
  });

  it('encurta o sha pra conferência a olho', () => {
    expect(shortSha('a'.repeat(64))).toBe('aaaaaaaaaaaa');
    expect(shortSha('')).toBe('');
  });

  it('deriva slug válido do nome do arquivo', () => {
    expect(slugFromName('deploy prod.env')).toBe('deploy-prod.env');
    expect(slugFromName('/tmp/x/.env')).toBe('env');
    expect(slugFromName('C:\\segredos\\chave.pem')).toBe('chave.pem');
    expect(slugFromName('..')).toBe('drop');
    expect(slugFromName('a'.repeat(80)).length).toBe(64);
  });
});
