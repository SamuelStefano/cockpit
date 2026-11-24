// Tamanho de drop é byte a kilobyte (um .env, uma chave, um script), escala que o
// fmtBytes da StatusBar (G/M) arredondaria pra "0M".
export function fmtDropBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '0 B';
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// sha256 curto: o suficiente pra conferir a olho contra um `sha256sum` sem ocupar
// a linha inteira com 64 hexas.
export function shortSha(sha: string): string {
  return typeof sha === 'string' ? sha.slice(0, 12) : '';
}

// Nome de arquivo → slug aceito pelo backend (/^[a-zA-Z0-9._-]{1,64}$/, sem ponto
// inicial). Preenche o campo de nome ao escolher um arquivo.
export function slugFromName(name: string): string {
  const s = (name.split(/[/\\]/).pop() ?? '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^[.]+/, '').slice(0, 64);
  return s || 'drop';
}

export interface DropPayload {
  content: string;
  // Absent = UTF-8 text through the original frame (works with agents that predate
  // binary drops); 'base64' = binary file.
  encoding?: 'base64';
  bytes: number;
}

// Bytes → base64 in chunks: String.fromCharCode(...bigArray) overflows the stack.
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Valid UTF-8 without NUL is text; anything else (.p8/.p12 DER, images) is binary.
export function classifyBytes(bytes: Uint8Array): DropPayload {
  if (!bytes.includes(0)) {
    try {
      return { content: new TextDecoder('utf-8', { fatal: true }).decode(bytes), bytes: bytes.length };
    } catch { /* not UTF-8 → binary */ }
  }
  return { content: bytesToBase64(bytes), encoding: 'base64', bytes: bytes.length };
}
