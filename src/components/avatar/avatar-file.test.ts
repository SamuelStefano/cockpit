import { describe, it, expect } from 'vitest';
import { avatarFileError, MAX_AVATAR_BYTES } from './avatar-file';

describe('avatarFileError', () => {
  it('aceita imagem dentro do limite', () => {
    expect(avatarFileError('image/png', 1024)).toBeNull();
    expect(avatarFileError('image/jpeg', MAX_AVATAR_BYTES)).toBeNull();
  });

  it('rejeita tipo que não é imagem', () => {
    expect(avatarFileError('application/pdf', 1024)).toBe('Escolha um arquivo de imagem.');
    expect(avatarFileError('text/plain', 1)).toBe('Escolha um arquivo de imagem.');
    expect(avatarFileError('', 1)).toBe('Escolha um arquivo de imagem.');
  });

  it('rejeita imagem acima do limite', () => {
    expect(avatarFileError('image/png', MAX_AVATAR_BYTES + 1)).toBe('Imagem acima de 10 MB.');
  });
});
