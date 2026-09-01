import type { ClientMsg } from '../../shared/protocol';

// Operações que tocam fs/spawn/grep — caras o bastante pra merecer um teto mais
// apertado que o global. Um loop de `search` (grep sobre centenas de MB) ou
// `term-open` (spawn de tmux) sem freio é o vetor de DoS quando houver 2º ator.
// `upload-chunk` fica FORA de propósito: um anexo de 15MB vira ~29 frames em rajada
// e o balde apertado (burst 15) derrubaria a metade final de todo arquivo grande.
// O teto dele é outro: MAX_ACTIVE_UPLOADS + maxUploadBytes em attachments.ts.
const HEAVY: ReadonlySet<ClientMsg['t']> = new Set([
  'search', 'term-open', 'send', 'list', 'list-archived', 'open', 'open-full', 'bench-build',
  'session-handoff', 'queue-run-bg', 'queue-run-now',
]);

export interface Bucket { tokens: number; last: number }

// Token bucket puro (tempo injetado p/ testar sem relógio): reabastece `rate`
// tokens/s até `burst` e consome 1 por chamada. Pura e determinística.
export function takeToken(bucket: Bucket, now: number, rate: number, burst: number): boolean {
  const elapsed = Math.max(0, now - bucket.last) / 1000;
  bucket.tokens = Math.min(burst, bucket.tokens + elapsed * rate);
  bucket.last = now;
  if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }
  return false;
}

const GLOBAL_RATE = 60, GLOBAL_BURST = 120;
const HEAVY_RATE = 8, HEAVY_BURST = 15;

// Limiter por conexão: um balde global (corta loop insano de qualquer frame) +
// um balde apertado só pras ops caras. `term-input`/`term-resize` (fluxo de
// digitação) passam só pelo global — o tamanho do term-input é capado à parte.
export function createRateLimiter(now = () => Date.now()) {
  const global: Bucket = { tokens: GLOBAL_BURST, last: now() };
  const heavy: Bucket = { tokens: HEAVY_BURST, last: now() };
  return {
    allow(t: ClientMsg['t']): boolean {
      const n = now();
      if (!takeToken(global, n, GLOBAL_RATE, GLOBAL_BURST)) return false;
      if (HEAVY.has(t) && !takeToken(heavy, n, HEAVY_RATE, HEAVY_BURST)) return false;
      return true;
    },
  };
}
