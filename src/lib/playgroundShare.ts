// Permalink do /play: serializa {linguagem, código} no hash da URL (base64url de
// JSON, UTF-8). Tudo client-side — o link carrega o sandbox vivo sem backend.
export interface SharePayload {
  lang: string;
  code: string;
}

const PREFIX = '#c=';
// Teto do token vindo da URL (atacante controla o #c=): acima disso rejeita antes
// de decodar/transpilar, senão um payload gigante trava a main thread na montagem.
// ~256 KB de token ≈ 192 KB de código — folgado pra qualquer snippet real.
const MAX_TOKEN = 256 * 1024;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): Uint8Array {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeShare(p: SharePayload): string {
  const json = JSON.stringify({ v: 1, l: p.lang, c: p.code });
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeShare(token: string): SharePayload | null {
  if (!token || token.length > MAX_TOKEN) return null;
  try {
    const obj = JSON.parse(new TextDecoder().decode(fromBase64Url(token)));
    if (obj && typeof obj.l === 'string' && typeof obj.c === 'string') return { lang: obj.l, code: obj.c };
  } catch {
    // token corrompido/truncado → trata como ausência de payload
  }
  return null;
}

export function buildShareUrl(lang: string, code: string): string {
  return `${location.origin}/play${PREFIX}${encodeShare({ lang, code })}`;
}

export function readShareFromLocation(): SharePayload | null {
  const h = location.hash;
  if (!h.startsWith(PREFIX)) return null;
  return decodeShare(h.slice(PREFIX.length));
}
