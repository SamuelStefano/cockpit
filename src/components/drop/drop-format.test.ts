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

import { classifyBytes, bytesToBase64 } from './drop-format';

describe('drop file payload', () => {
  it('keeps the dot in asc-api-key.p8', () => {
    expect(slugFromName('asc-api-key.p8')).toBe('asc-api-key.p8');
    expect(slugFromName('AuthKey ABC.p8')).toBe('AuthKey-ABC.p8');
  });
  it('sends valid UTF-8 as text', () => {
    const p = classifyBytes(new TextEncoder().encode('A=ção'));
    expect(p.encoding).toBeUndefined();
    expect(p.content).toBe('A=ção');
  });
  it('sends NUL or invalid UTF-8 as base64', () => {
    expect(classifyBytes(new Uint8Array([65, 0, 66])).encoding).toBe('base64');
    const p = classifyBytes(new Uint8Array([0xff, 0xfe, 0x80]));
    expect(p).toEqual({ content: '//6A', encoding: 'base64', bytes: 3 });
  });
  it('base64 of large input does not overflow the stack', () => {
    expect(bytesToBase64(new Uint8Array(1_000_000).fill(1)).length).toBe(1_333_336);
  });
});
