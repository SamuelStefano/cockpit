import { describe, it, expect } from 'vitest';
import { friendlyAuthError } from './useSupabaseAuth';

describe('friendlyAuthError', () => {
  it('maps invalid credentials', () => {
    expect(friendlyAuthError({ code: 'invalid_credentials' })).toBe('E-mail ou senha incorretos.');
    expect(friendlyAuthError({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.');
  });

  it('maps email already in use', () => {
    expect(friendlyAuthError({ code: 'user_already_exists' })).toBe('Este e-mail já está em uso.');
    expect(friendlyAuthError({ message: 'User already registered' })).toBe('Este e-mail já está em uso.');
  });

  it('maps weak password', () => {
    expect(friendlyAuthError({ code: 'weak_password' })).toBe('Senha muito fraca (mín. 6 caracteres).');
    expect(friendlyAuthError({ message: 'Password should be at least 6 characters' })).toBe('Senha muito fraca (mín. 6 caracteres).');
  });

  it('maps unconfirmed email and rate limits', () => {
    expect(friendlyAuthError({ code: 'email_not_confirmed' })).toBe('Confirme seu e-mail antes de entrar.');
    expect(friendlyAuthError({ code: 'over_email_send_rate_limit' })).toBe('Muitas tentativas. Aguarde um pouco.');
  });

  it('falls back to the raw message, then a generic line', () => {
    expect(friendlyAuthError({ message: 'Weird backend thing' })).toBe('Weird backend thing');
    expect(friendlyAuthError({})).toBe('Algo deu errado. Tente de novo.');
    expect(friendlyAuthError(null)).toBe('');
  });
});
