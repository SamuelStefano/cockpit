import { describe, it, expect } from 'vitest';
import { friendlyAuthError, recoveryFromUrl } from './useSupabaseAuth';

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

  it('maps the password change and recovery failures', () => {
    expect(friendlyAuthError({ code: 'same_password' })).toBe('A nova senha precisa ser diferente da atual.');
    expect(friendlyAuthError({ message: 'New password should be different from the old password' })).toBe('A nova senha precisa ser diferente da atual.');
    expect(friendlyAuthError({ code: 'otp_expired' })).toBe('Link de recuperação expirado. Peça outro.');
    expect(friendlyAuthError({ message: 'Email link is invalid or has expired' })).toBe('Link de recuperação expirado. Peça outro.');
    expect(friendlyAuthError({ message: 'Auth session missing!' })).toBe('Sessão expirada. Entre de novo.');
  });

  it('keeps the 6-char rule ahead of the "different password" rule', () => {
    expect(friendlyAuthError({ message: 'Password should be at least 6 characters' })).toBe('Senha muito fraca (mín. 6 caracteres).');
  });

  it('falls back to the raw message, then a generic line', () => {
    expect(friendlyAuthError({ message: 'Weird backend thing' })).toBe('Weird backend thing');
    expect(friendlyAuthError({})).toBe('Algo deu errado. Tente de novo.');
    expect(friendlyAuthError(null)).toBe('');
  });
});

describe('recoveryFromUrl', () => {
  it('reconhece o redirectTo do link de recuperação', () => {
    expect(recoveryFromUrl('?reset=1')).toBe(true);
    expect(recoveryFromUrl('?foo=bar&reset=1')).toBe(true);
  });

  it('não confunde com navegação normal', () => {
    expect(recoveryFromUrl('')).toBe(false);
    expect(recoveryFromUrl('?reset=0')).toBe(false);
    expect(recoveryFromUrl('?resetting=1')).toBe(false);
  });
});
