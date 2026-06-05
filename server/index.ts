import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { attachWs } from './ws';
import { CONFIG } from './config';

async function main() {
  await mkdir(CONFIG.workdir, { recursive: true }); // cwd isolado (DR-004 #4)

  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('cockpit backend ok\n');
  });

  attachWs(server);

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`cockpit backend em http://${CONFIG.host}:${CONFIG.port} (ws /ws, permission=${CONFIG.permissionMode})`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
