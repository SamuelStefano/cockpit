// O path no disco leva prefixo aleatório (ts36-hex-nome), e print colado chega
// sempre como "image.png": o mesmo arquivo anexado de novo só casa pelo CONTEÚDO.
// Reenviar anexo repetido custava um turno inteiro do agente só pra ele avisar.

export type SentHashes = Record<string, string[]>;
export type DupKind = 'sent' | 'composer';

export const SENT_HASHES_KEY = 'sentAttHashes';
const MAX_PER_SESSION = 100;
const MAX_SESSIONS = 40;

// crypto.subtle só existe em contexto seguro; o Deck aberto por http na Tailscale
// cairia sem dedup nenhum. FNV-1a + tamanho é fraco contra colisão proposital, mas
// aqui só decide se aparece um aviso.
function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return `fnv-${(h >>> 0).toString(16)}-${bytes.length}`;
}

// O upload já lê o arquivo inteiro como base64; hashear um vídeo grande dobraria
// a memória no celular. Acima disto fica sem aviso de repetido.
export const MAX_DIGEST_BYTES = 64 * 1024 * 1024;

export async function digestFile(file: Blob): Promise<string | undefined> {
  if (file.size > MAX_DIGEST_BYTES) return undefined;
  try {
    const buf = await file.arrayBuffer();
    if (globalThis.crypto?.subtle) {
      const d = await globalThis.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return fnv1a(new Uint8Array(buf));
  } catch {
    return undefined;
  }
}

// A sessão tocada vai pro fim: a ordem das chaves vira LRU e o corte descarta as
// sessões mais antigas, pra o localStorage não crescer sem teto.
export function rememberSent(all: SentHashes, key: string, hashes: string[]): SentHashes {
  const fresh = hashes.filter(Boolean);
  if (!fresh.length) return all;
  const merged = [...(all[key] ?? []).filter((h) => !fresh.includes(h)), ...fresh].slice(-MAX_PER_SESSION);
  const { [key]: _prev, ...rest } = all;
  const next: SentHashes = { ...rest, [key]: merged };
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SESSIONS))) delete next[k];
  return next;
}

export function markDuplicates<T extends { hash?: string }>(atts: T[], sent: string[] | undefined): (T & { dup?: DupKind })[] {
  const sentSet = new Set(sent ?? []);
  const seen = new Set<string>();
  return atts.map((a) => {
    if (!a.hash) return a;
    if (sentSet.has(a.hash)) return { ...a, dup: 'sent' as const };
    if (seen.has(a.hash)) return { ...a, dup: 'composer' as const };
    seen.add(a.hash);
    return a;
  });
}
