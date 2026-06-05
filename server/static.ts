import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, resolve, extname, normalize } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

// Serve a SPA buildada (dist/) na MESMA porta do WS — um único bind 127.0.0.1
// pra acesso via Tailscale. Anti-traversal: resolve sob root e exige prefixo.
export function makeStatic(distRoot: string) {
  const root = resolve(distRoot);

  return async function serve(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;

    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    let file = resolve(join(root, rel));
    if (file !== root && !file.startsWith(root + '/')) { res.writeHead(403).end(); return true; }

    let st = await stat(file).catch(() => null);
    if (st?.isDirectory()) { file = join(file, 'index.html'); st = await stat(file).catch(() => null); }
    // SPA fallback: rota desconhecida sem extensão -> index.html
    if (!st && !extname(file)) { file = join(root, 'index.html'); st = await stat(file).catch(() => null); }
    if (!st) return false;

    const type = TYPES[extname(file)] || 'application/octet-stream';
    const immutable = file.includes('/assets/');
    res.writeHead(200, {
      'content-type': type,
      'content-length': st.size,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') { res.end(); return true; }
    createReadStream(file).pipe(res);
    return true;
  };
}
