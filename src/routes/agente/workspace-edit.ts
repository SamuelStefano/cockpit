const EDITABLE_EXT = /\.(md|txt|json|ya?ml)$/i;

export const isEditablePath = (path: string): boolean =>
  EDITABLE_EXT.test(path) && path.split('/').every((s) => s && !s.startsWith('.') && s !== '..');

export function newFilePath(raw: string): string | null {
  const name = raw.trim().replace(/^\/+/, '');
  if (!name) return null;
  const path = /\.md$/i.test(name) ? name : `${name}.md`;
  return isEditablePath(path) ? path : null;
}

export const CONFLICT_COPY = 'O arquivo mudou desde que você abriu. Recarregue antes de salvar.';

export const saveErrorCopy = (error: string): string => (error === 'conflito' ? CONFLICT_COPY : error);
