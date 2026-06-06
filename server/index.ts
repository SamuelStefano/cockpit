import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { attachWs, killAllRuns } from './ws';
import { makeStatic } from './static';
import { sweepAttachments } from './attachments';
import { checkpointWal } from './db';
import { CONFIG } from './config';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

async function main() {
  await mkdir(CONFIG.workdir, { recursive: true }); // cwd isolado (DR-004 #4)

  const serveStatic = makeStatic(distDir);

  const server = createServer((req, res) => {
    serveStatic(req, res).then((served) => {
      if (served) return;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('cockpit backend ok (rode `npm run build` p/ servir a UI)\n');
    }).catch(() => { res.writeHead(500).end(); });
  });

  attachWs(server);

  // Limpeza de anexos velhos: na subida + a cada 6h (daily driver fica de pé).
  const sweep = () => { sweepAttachments().catch(() => {}); checkpointWal(); };
  sweep();
  setInterval(sweep, 6 * 60 * 60 * 1000).unref();

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`cockpit em http://${CONFIG.host}:${CONFIG.port} (ws /ws, permission=${CONFIG.permissionMode})`);
  });

  // Encerramento limpo: mata as árvores de run antes de sair, senão os `claude`
  // detached viram zumbis órfãos no restart. SIGTERM já foi enviado ao grupo de
  // forma síncrona em kill(); o pequeno atraso só garante a entrega antes do exit.
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    killAllRuns();
    setTimeout(() => process.exit(0), 300);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
