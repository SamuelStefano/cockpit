import type { ClientMsg } from '../../shared/protocol';

// Mensagens que só o admin pode disparar. Hoje currentRole() é 'admin' constante
// (loopback single-user), então o gate é defense-in-depth pra Fase 2 (DR-011):
// quando role passar a sair do token, student NÃO pode abrir shell/terminal nem
// ver o painel admin sem reescrever o roteador. term-* dá shell interativo no
// host (mais poderoso que o bypass, que já é gated) e admin-health é recon.
const ADMIN_ONLY: ReadonlySet<ClientMsg['t']> = new Set([
  'admin-health',
  'term-open',
  'term-input',
  'term-resize',
  'term-detach',
  'term-close',
  'term-list',
]);

export function isAdminOnly(t: ClientMsg['t']): boolean {
  return ADMIN_ONLY.has(t);
}

// Operações que tocam fs/spawn/grep — caras o bastante pra merecer um teto mais
// apertado que o global. Um loop de `search` (grep sobre centenas de MB) ou
// `term-open` (spawn de tmux) sem freio é o vetor de DoS quando houver 2º ator.
const HEAVY: ReadonlySet<ClientMsg['t']> = new Set([
  'search', 'upload', 'term-open', 'send', 'list', 'list-archived', 'open', 'open-full',
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
