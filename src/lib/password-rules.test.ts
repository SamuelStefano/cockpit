import { describe, it, expect } from 'vitest';
import { newPasswordError, MIN_PASSWORD } from './password-rules';

describe('newPasswordError', () => {
  it('exige o mínimo de caracteres', () => {
    expect(newPasswordError('12345', '12345')).toBe(`A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`);
    expect(newPasswordError('', '')).toContain('pelo menos');
  });

  it('exige confirmação igual', () => {
    expect(newPasswordError('segredo1', 'segredo2')).toBe('As senhas não conferem.');
  });

  it('aceita senha longa o bastante e confirmada', () => {
    expect(newPasswordError('segredo1', 'segredo1')).toBe('');
  });

  it('checa tamanho antes de confirmação — erro mais útil primeiro', () => {
    expect(newPasswordError('123', 'outro')).toContain('pelo menos');
  });
});
