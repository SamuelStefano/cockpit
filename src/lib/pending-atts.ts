import { loadPref, savePref, removePref } from './persist';
import type { Attachment } from '../useCockpit';

// Anexos ainda no composer, guardados POR SESSÃO. Toda troca de sessão tem que
// reidratar por aqui: quando um caminho de troca mexia no activeRef na mão (o
// "nova sessão" fazia isso), os chips da sessão anterior ficavam no composer da
// nova e a próxima gravação os carimbava também na key nova — a imagem seguia o
// usuário de chat em chat e ele tinha que remover na mão.
const key = (sessionKey: string) => `pendingAtts:${sessionKey}`;

export function loadPendingAtts(sessionKey: string): Attachment[] {
  return sessionKey ? loadPref<Attachment[]>(key(sessionKey), []) : [];
}

// Chip 'uploading' tem path temporário (clientId) que não sobrevive ao reload —
// só anexo confirmado é persistido. Lista vazia APAGA a entrada: senão cada
// sessão que já teve anexo deixa um `[]` eterno no localStorage.
export function savePendingAtts(sessionKey: string, atts: Attachment[]): void {
  if (!sessionKey) return;
  const keep = atts.filter((a) => !a.uploading);
  if (keep.length) savePref(key(sessionKey), keep);
  else removePref(key(sessionKey));
}

export function clearPendingAtts(sessionKey: string): void {
  if (sessionKey) removePref(key(sessionKey));
}

// Ack de upload que chegou pra uma sessão que não está aberta: grava direto nos
// pendentes dela, pra reaparecer no composer certo quando o usuário voltar.
export function addPendingAtt(sessionKey: string, att: Attachment): void {
  const prev = loadPendingAtts(sessionKey);
  savePendingAtts(sessionKey, [...prev.filter((a) => a.path !== att.path), att]);
}

// Sessão local `new-xxx` virou uuid real: sem mover, um ack de upload em voo
// gravaria na key morta e o anexo sumia do composer.
export function movePendingAtts(oldKey: string, newKey: string): void {
  const prev = loadPendingAtts(oldKey);
  clearPendingAtts(oldKey);
  if (!prev.length) return;
  const dest = loadPendingAtts(newKey);
  const paths = new Set(dest.map((a) => a.path));
  savePendingAtts(newKey, [...dest, ...prev.filter((a) => !paths.has(a.path))]);
}
