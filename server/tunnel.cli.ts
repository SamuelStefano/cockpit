import {
  createRequest, popPending, markReady, markClosed, listTunnels,
  parseRelayCommand, pollOnce, SERVICES,
} from './tunnel';

// CLI `deck-tunnel`. Eu (agente na VPS) uso `request`; o daemon do desktop entra por
// SSH forced-command e cai em `relay`. A lógica/fila vive em tunnel.ts (testável);
// aqui só ficam os efeitos: argv, sono (await/hold) e prints.

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function flag(args: string[], name: string): string | undefined {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function cmdRequest(args: string[]): Promise<number> {
  const service = args[0];
  if (!service) { console.error(`uso: deck-tunnel request <serviço>  (conhecidos: ${Object.keys(SERVICES).join(', ')})`); return 1; }
  const ttlSec = flag(args, 'ttl') ? parseInt(flag(args, 'ttl')!, 10) : undefined;
  const timeoutMs = (flag(args, 'timeout') ? parseInt(flag(args, 'timeout')!, 10) : 30) * 1000;
  let t;
  try { t = createRequest(service, { ttlSec }); }
  catch (e) { console.error((e as Error).message); return 1; }
  console.error(`[deck-tunnel] pedido ${t.id} (${service}) — aguardando o desktop abrir…`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = pollOnce(t.id);
    if (r.done) {
      console.log(JSON.stringify({ id: r.tunnel.id, service, remotePort: r.tunnel.remotePort, expiresAt: r.tunnel.expiresAt }));
      console.error(`[deck-tunnel] pronto em 127.0.0.1:${r.tunnel.remotePort} (expira ${new Date(r.tunnel.expiresAt!).toLocaleTimeString()})`);
      return 0;
    }
    if (r.reason) { console.error(`[deck-tunnel] falhou: ${r.reason}`); return 1; }
    await sleep(1000);
  }
  console.error('[deck-tunnel] timeout — o daemon do desktop está rodando e pareado?');
  return 1;
}

async function cmdRelay(): Promise<number> {
  const parsed = parseRelayCommand(process.env.SSH_ORIGINAL_COMMAND);
  switch (parsed.kind) {
    case 'pop': console.log(JSON.stringify(popPending())); return 0;
    case 'list': console.log(JSON.stringify(listTunnels())); return 0;
    case 'ready':
      try { markReady(parsed.id, parsed.port); console.log('ok'); return 0; }
      catch (e) { console.error((e as Error).message); return 1; }
    case 'hold': await sleep(parsed.sec * 1000); return 0;
    case 'reject': console.error(`[deck-tunnel] recusado: ${parsed.reason}`); return 1;
  }
}

async function main(): Promise<number> {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'request': return cmdRequest(args);
    case 'relay': return cmdRelay();
    case 'list': console.log(JSON.stringify(listTunnels(), null, 2)); return 0;
    case 'close':
      if (!args[0]) { console.error('uso: deck-tunnel close <id>'); return 1; }
      markClosed(args[0]); console.log(`fechado ${args[0]}`); return 0;
    default:
      console.error('uso: deck-tunnel <request|list|close|relay>');
      return 1;
  }
}

main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
