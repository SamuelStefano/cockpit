import type { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import type { Duplex } from 'node:stream';

const PREVIEW_DOMAIN = 'preview.devfellowship.com';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

// Um iframe apontando pra outra origem é "terceiro" pro navegador: cookie de sessão
// com SameSite=Lax é recusado e o localStorage vem particionado, então o preview
// abre deslogado e o login não gruda. `<slug>.localhost` é MESMO SITE que o
// `localhost` do Deck, então servir o preview daqui devolve o comportamento de
// first-party. O domínio de destino é fixo e o slug tem charset restrito — isto
// nunca vira proxy aberto.
export function sandboxUpstream(hostHeader?: string): string | undefined {
  const host = hostHeader?.split(':')[0].toLowerCase();
  if (!host?.endsWith('.localhost')) return undefined;
  const slug = host.slice(0, -'.localhost'.length);
  return SLUG_RE.test(slug) ? `${slug}.${PREVIEW_DOMAIN}` : undefined;
}

// Sem Domain o cookie cai no host da requisição (`<slug>.localhost`), que é o que
// queremos; `Secure` iria embora numa origem http e o cookie sumiria de vez.
export function rewriteSetCookie(values: string[]): string[] {
  return values.map((c) =>
    c.split(';')
      .filter((p) => !/^\s*(domain|secure)\s*(=|$)/i.test(p))
      .join(';'),
  );
}

export function rewriteLocation(location: string, upstream: string): string {
  try {
    const url = new URL(location);
    return url.host === upstream ? url.pathname + url.search + url.hash : location;
  } catch {
    return location;
  }
}

function rewriteHeaders(headers: IncomingHttpHeaders, upstream: string): IncomingHttpHeaders {
  const out: IncomingHttpHeaders = { ...headers };
  // HSTS emitido pelo upstream fixaria https em `<slug>.localhost` e derrubaria o
  // preview pra sempre nesse navegador.
  delete out['strict-transport-security'];
  delete out['x-frame-options'];
  if (headers['set-cookie']) out['set-cookie'] = rewriteSetCookie(headers['set-cookie']);
  if (typeof headers.location === 'string') out.location = rewriteLocation(headers.location, upstream);
  return out;
}

const REWRITABLE = /\b(text\/html|text\/css|javascript|json)\b/i;

// O app embute a própria URL de preview (é de lá que ele fala com o Supabase). Servido
// pelo proxy, esse endereço absoluto vira cross-origin e o login morre em CORS —
// exatamente o "coloquei as credenciais e não logou". Trocar a origem no corpo faz
// essas chamadas voltarem pro proxy, onde são same-origin.
export function rewriteBody(body: string, upstream: string, proxyOrigin: string): string {
  return body
    .split(`https://${upstream}`).join(proxyOrigin)
    .split(`wss://${upstream}`).join(proxyOrigin.replace(/^http/, 'ws'));
}

export function proxySandbox(upstream: string, req: IncomingMessage, res: ServerResponse): void {
  const proxyOrigin = `http://${req.headers.host}`;
  // Sem isto o corpo chega comprimido e não dá pra reescrever a origem embutida.
  const headers = { ...req.headers, host: upstream, 'accept-encoding': 'identity' };
  const up = httpsRequest(
    { host: upstream, port: 443, servername: upstream, method: req.method, path: req.url, headers },
    (r) => {
      const out = rewriteHeaders(r.headers, upstream);
      if (!REWRITABLE.test(String(r.headers['content-type'] ?? ''))) {
        res.writeHead(r.statusCode ?? 502, out);
        r.pipe(res);
        return;
      }
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => {
        const body = Buffer.from(rewriteBody(Buffer.concat(chunks).toString('utf8'), upstream, proxyOrigin));
        out['content-length'] = String(body.byteLength);
        res.writeHead(r.statusCode ?? 502, out);
        res.end(body);
      });
    },
  );
  up.on('error', (e) => {
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`sandbox indisponível: ${e.message}\n`);
  });
  req.pipe(up);
}

// O dev server do Vite mantém o HMR num WebSocket. Sem repassar o upgrade o cliente
// entra em loop de reconexão e mostra o overlay de "server connection lost".
export function proxySandboxUpgrade(upstream: string, req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const up = tlsConnect({ host: upstream, port: 443, servername: upstream }, () => {
    const lines = [`GET ${req.url} HTTP/1.1`, `host: ${upstream}`];
    for (const [k, v] of Object.entries(req.headers)) {
      if (k === 'host') continue;
      for (const one of Array.isArray(v) ? v : [v]) if (one !== undefined) lines.push(`${k}: ${one}`);
    }
    up.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  const drop = () => { up.destroy(); socket.destroy(); };
  up.on('error', drop);
  socket.on('error', drop);
}
