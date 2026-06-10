export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

export function avatarFileError(type: string, size: number): string | null {
  if (!type.startsWith('image/')) return 'Escolha um arquivo de imagem.';
  if (size > MAX_AVATAR_BYTES) return 'Imagem acima de 10 MB.';
  return null;
}
