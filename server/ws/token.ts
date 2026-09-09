import { createHash, timingSafeEqual } from 'node:crypto';

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
// legado). Com token → exige igualdade constante-no-tempo.
//
// Compara os DIGESTS, não os bytes crus: `timingSafeEqual` joga quando os
// tamanhos diferem, então a versão anterior tinha um `a.length !== b.length`
// antes dele — e esse return curto respondia mais rápido, vazando o tamanho do
// token. Era pré-existente do WS (loopback), mas a rota /mcp pôs a comparação na
// frente da rede. sha256 sempre dá 32 bytes, então o caminho é único.
export function tokenAllowed(expected: string, got: string): boolean {
  if (!expected) return true;
  if (!got) return false;
  return timingSafeEqual(sha256(expected), sha256(got));
}

function sha256(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest();
}
