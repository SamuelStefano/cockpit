import { WebSocket } from 'ws';
import { generateKeyPairSync, createPrivateKey, sign as edSign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Role } from './auth';
import { serveConnection } from './ws/serve-connection';
import { setClientSource } from './ws/broadcast';
import { killAllRuns } from './ws/runs';

// Entrypoint do AGENTE T3 (DR-023): em vez de escutar (attachWs), DISCA pro relay
// e serve o MESMO protocolo pelo socket de saída. O relay encaminha os frames do
// browser daquela conta pra cá; o engine roda local (claude -p na VPS do fellow) e
// as respostas voltam por broadcast → setClientSource([socket]) → relay → browser.
// Reusa serveConnection (idêntico ao listen). A chave privada NASCE e FICA aqui.

const DIR = process.env.DECK_AGENT_DIR || join(homedir(), '.deck-agent');
const ID_FILE = join(DIR, 'identity.json');

// Role do engine pro agente do fellow no MVP: 'student' = chat (send/stop/sessões/
// contexts) SEM term-*/bypass/admin (allowlist do authz). É o "least-capability"
// em runtime até o compile-out (T1) remover term-*/bypass do build fisicamente.
const AGENT_ROLE: Role = 'student';

export interface Identity { agentId: string; privateKeyPem: string; publicKey: string }

// Gera um par Ed25519. Privada em PKCS8 PEM (fica no disco do fellow, 0600);
// pública em SPKI DER base64 — o formato que o relay (verifyAgentSignature) espera.
export function generateIdentityKeys(): { privateKeyPem: string; publicKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  };
}

export function loadIdentity(): Identity | null {
  try { return JSON.parse(readFileSync(ID_FILE, 'utf8')) as Identity; } catch { return null; }
}

export function saveIdentity(id: Identity): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(ID_FILE, JSON.stringify(id, null, 2));
  try { chmodSync(ID_FILE, 0o600); } catch { /* best-effort em FS sem perms */ }
}

// Assina o challenge do relay com a privada. Base64, igual ao que verifyAgentSignature lê.
export function signChallenge(privateKeyPem: string, challenge: string): string {
  return edSign(null, Buffer.from(challenge), createPrivateKey(privateKeyPem)).toString('base64');
}

// Backoff exponencial com teto (reconnect do dial; o listen nunca precisou).
export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
}

function connect(relayUrl: string, id: Identity, onClose: () => void): WebSocket {
  const ws = new WebSocket(`${relayUrl.replace(/\/$/, '')}/agent`);
  let ready = false;

  const onHandshake = (raw: import('ws').RawData) => {
    let m: { t?: string; nonce?: string } = {};
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.t === 'challenge' && typeof m.nonce === 'string') {
      ws.send(JSON.stringify({ t: 'agent-auth', sig: signChallenge(id.privateKeyPem, m.nonce) }));
    } else if (m.t === 'agent-ready') {
      ready = true;
      ws.removeListener('message', onHandshake);   // serveConnection assume o loop
      setClientSource({ clients: new Set([ws]) });  // broadcast sai por ESTE socket
      serveConnection(ws, { role: AGENT_ROLE });
    }
  };

  ws.on('open', () => ws.send(JSON.stringify({ t: 'agent-hello', agentId: id.agentId })));
  ws.on('message', onHandshake);
  ws.on('close', () => { if (ready) setClientSource(null); onClose(); });
  ws.on('error', () => { /* o 'close' cuida do reconnect */ });

  const beat = setInterval(() => { try { ws.ping(); } catch { /* indo embora */ } }, 30_000);
  beat.unref();
  ws.on('close', () => clearInterval(beat));
  return ws;
}

// Pareia esta VPS com a conta dona do código. Gera (ou reusa) a keypair local,
// apresenta código+pubkey ao relay, salva o agentId devolvido. A privada nunca sai.
export function pairAgent(relayUrl: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = loadIdentity();
    const keys = existing?.privateKeyPem
      ? { privateKeyPem: existing.privateKeyPem, publicKey: existing.publicKey }
      : generateIdentityKeys();
    const ws = new WebSocket(`${relayUrl.replace(/\/$/, '')}/agent`);
    let done = false;
    ws.on('open', () => ws.send(JSON.stringify({ t: 'pair', code, publicKey: keys.publicKey })));
    ws.on('message', (raw) => {
      let m: { t?: string; agentId?: string } = {};
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.t === 'paired' && typeof m.agentId === 'string') {
        saveIdentity({ agentId: m.agentId, privateKeyPem: keys.privateKeyPem, publicKey: keys.publicKey });
        done = true;
        console.log(`[agent] pareado! identidade salva em ${ID_FILE}`);
        ws.close();
        resolve();
      }
    });
    ws.on('close', () => { if (!done) reject(new Error('pareamento falhou (código inválido/expirado?)')); });
    ws.on('error', (e) => { if (!done) reject(e); });
  });
}

export function runAgent(relayUrl: string): void {
  const id = loadIdentity();
  if (!id?.agentId) {
    console.error('[agent] não pareado. Rode o pairing (npx @deck/agent --pair=CÓDIGO) primeiro.');
    process.exit(1);
  }
  let attempt = 0;
  const loop = () => {
    connect(relayUrl, id, () => {
      const wait = backoffMs(attempt++);
      console.error(`[agent] desconectado; reconectando em ${Math.round(wait / 1000)}s`);
      setTimeout(loop, wait);
    });
    attempt = 0; // zera ao conseguir abrir (reset no próximo open via heurística simples)
  };
  loop();
  process.on('SIGTERM', () => { killAllRuns(); process.exit(0); });
  process.on('SIGINT', () => { killAllRuns(); process.exit(0); });
}

// Execução direta: `tsx server/agent.ts [--pair=CÓDIGO]` (relay via DECK_RELAY_URL).
if (process.argv[1] && process.argv[1].endsWith('agent.ts')) {
  const url = process.env.DECK_RELAY_URL;
  if (!url) { console.error('[agent] defina DECK_RELAY_URL'); process.exit(1); }
  const pairArg = process.argv.find((a) => a.startsWith('--pair='));
  if (pairArg) {
    pairAgent(url, pairArg.slice('--pair='.length))
      .then(() => process.exit(0))
      .catch((e) => { console.error('[agent]', e.message ?? e); process.exit(1); });
  } else {
    runAgent(url);
  }
}
