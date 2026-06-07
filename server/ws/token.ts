import { timingSafeEqual } from 'node:crypto';

// Gate de auth do handshake do WS (DR-011 Fase 2). Browsers não conseguem mandar
// header custom no upgrade do WebSocket, então o token compartilhado viaja na
// query string (?token=...). É o canal viável pra um login single-account.

export function tokenFromUrl(url: string | undefined): string {
  if (!url) return '';
  const q = url.indexOf('?');
  if (q < 0) return '';
  return new URLSearchParams(url.slice(q + 1)).get('token') ?? '';
}

// Sem token configurado no servidor → libera (loopback-only, comportamento
// legado). Com token → exige igualdade constante-no-tempo pra não vazar o tamanho
// nem servir de oráculo de timing.
export function tokenAllowed(expected: string, got: string): boolean {
  if (!expected) return true;
  if (!got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
