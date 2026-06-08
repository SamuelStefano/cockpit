import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { attachWs, killAllRuns, runStats } from './ws';
import { makeStatic } from './static';
import { sweepAttachments } from './attachments';
import { checkpointWal, sweepUsage } from './db';
import { loadManagedEnv } from './admin-ops';
import { CONFIG } from './config';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

async function main() {
  await mkdir(CONFIG.workdir, { recursive: true }); // cwd isolado (DR-004 #4)
  await loadManagedEnv(); // tokens gerenciados (#162) p/ o spawn herdar

  const serveStatic = makeStatic(distDir);

  const server = createServer((req, res) => {
    // Liveness: o supervisor (run-backend.sh) faz poll disto pra detectar backend
    // pendurado-mas-vivo — se isto responde, o event loop não travou de vez.
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...runStats() }));
      return;
    }
    serveStatic(req, res).then((served) => {
      if (served) return;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('cockpit backend ok (rode `npm run build` p/ servir a UI)\n');
    }).catch(() => { res.writeHead(500).end(); });
  });

  attachWs(server);

  // Limpeza de anexos velhos: na subida + a cada 6h (daily driver fica de pé).
  const sweep = () => { sweepAttachments().catch(() => {}); sweepUsage(); checkpointWal(); };
  sweep();
  setInterval(sweep, 6 * 60 * 60 * 1000).unref();

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`cockpit em http://${CONFIG.host}:${CONFIG.port} (ws /ws, permission=${CONFIG.permissionMode})`);
  });

  // Encerramento limpo: mata as árvores de run antes de sair, senão os `claude`
  // detached viram zumbis órfãos no restart. SIGTERM já foi enviado ao grupo de
  // forma síncrona em kill(); o pequeno atraso só garante a entrega antes do exit.
  let closing = false;
  const shutdown = (code: number) => {
    if (closing) return;
    closing = true;
    killAllRuns();
    setTimeout(() => process.exit(code), 300);
  };
  process.once('SIGINT', () => shutdown(0));
  process.once('SIGTERM', () => shutdown(0));

  // Backstop pro throw inesperado que escapa dos try/catch por-caminho (callback
  // de pty, handler de connection, tick de stats). Sem isto o Node morre no
  // default SEM matar a árvore de runs — cada `claude -p` detached vira zumbi
  // queimando token a noite toda. Falha alto e LIMPO: mata os runs, depois sai.
  process.on('uncaughtException', (err) => { console.error('uncaughtException', err); shutdown(1); });
  process.on('unhandledRejection', (reason) => { console.error('unhandledRejection', reason); shutdown(1); });
}

main().catch((e) => { console.error(e); process.exit(1); });
