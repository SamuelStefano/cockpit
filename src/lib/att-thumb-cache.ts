// Cache de thumbnails (path → base64) com teto de bytes, não de entradas: uma
// imagem pode ter 20MB em base64, então N entradas não diz nada sobre memória.
// Evita o crescimento sem limite ao rolar um histórico cheio de imagens.
export const THUMB_CACHE_MAX_CHARS = 24_000_000;
// Teto POR entrada (~2MB de binário): um pdf/vídeo de 15MB aberto no modal não
// pode entrar no cache e expulsar todas as thumbs de imagem de uma vez.
export const THUMB_ENTRY_MAX_CHARS = 2_700_000;

export function addThumb(
  prev: Record<string, string>,
  path: string,
  dataB64: string,
  maxChars: number = THUMB_CACHE_MAX_CHARS,
  entryCap: number = THUMB_ENTRY_MAX_CHARS,
): Record<string, string> {
  if (prev[path] !== undefined || dataB64.length > maxChars || dataB64.length > entryCap) return prev;
  const next = { ...prev, [path]: dataB64 };
  let total = 0;
  for (const v of Object.values(next)) total += v.length;
  // Record preserva ordem de inserção → as chaves mais antigas saem primeiro.
  for (const k of Object.keys(next)) {
    if (total <= maxChars) break;
    if (k === path) continue;
    total -= next[k].length;
    delete next[k];
  }
  return next;
}

// Guarda anti-livelock: path expulso do cache NÃO re-pede (continua em
// `requested`) — senão chips montados acima do teto ficam se expulsando e
// re-baixando o arquivo inteiro em loop.
export function shouldRequestThumb(
  cache: Record<string, string>,
  pending: Set<string>,
  requested: Set<string>,
  path: string,
): boolean {
  return cache[path] === undefined && !pending.has(path) && !requested.has(path);
}
