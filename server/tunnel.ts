import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Túneis on-demand VPS↔desktop (plano 20260626-deck-on-demand-tunnels). O agente
// roda na VPS e NÃO alcança o desktop (NAT) — então só REGISTRA um pedido aqui; um
// daemon no desktop faz poll (via SSH), abre o túnel reverso e marca `ready`. A fila
// é um diretório de arquivos JSON (um por túnel) — sem driver de DB, igual ao resto
// do agente. A chave SSH do desktop é forced-command `deck-tunnel relay`, por isso
// `parseRelayCommand` é a fronteira do que o desktop pode pedir (só pop/ready/list/hold).

export const PORT_MIN = 27100;
export const PORT_MAX = 27200;
export const DEFAULT_TTL_SEC = 600;
export const MAX_TTL_SEC = 3600;

export type TunnelStatus = 'pending' | 'claimed' | 'ready' | 'closed' | 'expired';

export interface Tunnel {
  id: string;
  service: string;
  localPort: number;
  remotePort: number;
  ttlSec: number;
  status: TunnelStatus;
  createdAt: number;
  readyAt?: number;
  expiresAt?: number;
}

export interface ServiceDef { localPort: number; remotePort: number; desc: string }

// Serviços conhecidos: localPort = porta no desktop; remotePort = porta preferida no
// loopback da VPS (cai pro range se ocupada). Crescer aqui pra cada novo consumidor.
export const SERVICES: Record<string, ServiceDef> = {
  obsidian: { localPort: 27123, remotePort: 27123, desc: 'Obsidian Local REST API (MCP)' },
};

function baseDir(): string {
  return process.env.DECK_TUNNEL_DIR || join(homedir(), '.deck-agent', 'tunnels');
}

function filePath(id: string): string {
  return join(baseDir(), `${id}.json`);
}

function ensureDir(): void {
  mkdirSync(baseDir(), { recursive: true });
}

function writeTunnel(t: Tunnel): void {
  ensureDir();
  const tmp = filePath(t.id) + '.tmp';
  writeFileSync(tmp, JSON.stringify(t, null, 2) + '\n', 'utf8');
  renameSync(tmp, filePath(t.id));
}

function readTunnel(id: string): Tunnel | null {
  try { return JSON.parse(readFileSync(filePath(id), 'utf8')) as Tunnel; } catch { return null; }
}

export function getTunnel(id: string): Tunnel | null {
  return readTunnel(id);
}

function readAllRaw(): Tunnel[] {
  ensureDir();
  const out: Tunnel[] = [];
  for (const f of readdirSync(baseDir())) {
    if (!f.endsWith('.json')) continue;
    try { out.push(JSON.parse(readFileSync(join(baseDir(), f), 'utf8')) as Tunnel); } catch { /* arquivo corrompido/parcial: ignora */ }
  }
  return out;
}

function isActive(t: Tunnel, now: number): boolean {
  if (t.status === 'closed' || t.status === 'expired') return false;
  if (t.expiresAt && now > t.expiresAt) return false;
  return true;
}

// Marca expirados (ready vencido) e apaga lixo antigo (closed/expired > 1h). Idempotente.
export function purgeExpired(now = Date.now()): void {
  for (const t of readAllRaw()) {
    if ((t.status === 'ready' || t.status === 'claimed' || t.status === 'pending') && t.expiresAt && now > t.expiresAt) {
      writeTunnel({ ...t, status: 'expired' });
      continue;
    }
    if ((t.status === 'closed' || t.status === 'expired') && now - (t.readyAt ?? t.createdAt) > 3_600_000) {
      try { rmSync(filePath(t.id)); } catch { /* já removido */ }
    }
  }
}

function assignRemotePort(service: ServiceDef, now: number): number {
  const taken = new Set(readAllRaw().filter(t => isActive(t, now)).map(t => t.remotePort));
  if (!taken.has(service.remotePort)) return service.remotePort;
  for (let p = PORT_MIN; p <= PORT_MAX; p++) if (!taken.has(p)) return p;
  throw new Error('sem porta livre no range de túnel');
}

export function createRequest(service: string, opts: { ttlSec?: number } = {}): Tunnel {
  const def = SERVICES[service];
  if (!def) throw new Error(`serviço desconhecido: ${service} (conhecidos: ${Object.keys(SERVICES).join(', ')})`);
  const now = Date.now();
  purgeExpired(now);
  const ttlSec = Math.min(Math.max(opts.ttlSec ?? DEFAULT_TTL_SEC, 1), MAX_TTL_SEC);
  const t: Tunnel = {
    id: randomUUID().slice(0, 8),
    service,
    localPort: def.localPort,
    remotePort: assignRemotePort(def, now),
    ttlSec,
    status: 'pending',
    createdAt: now,
  };
  writeTunnel(t);
  return t;
}

// Chamado pelo desktop (via SSH forced-command). Entrega os pendentes e marca
// `claimed` pra não reentregar antes do `ready`.
export function popPending(): Tunnel[] {
  const now = Date.now();
  purgeExpired(now);
  const pending = readAllRaw().filter(t => t.status === 'pending');
  return pending.map(t => { const c: Tunnel = { ...t, status: 'claimed' }; writeTunnel(c); return c; });
}

export function markReady(id: string, remotePort?: number): Tunnel {
  const t = readTunnel(id);
  if (!t) throw new Error(`túnel ${id} não existe`);
  const now = Date.now();
  const ready: Tunnel = {
    ...t,
    status: 'ready',
    readyAt: now,
    expiresAt: now + t.ttlSec * 1000,
    ...(remotePort ? { remotePort } : {}),
  };
  writeTunnel(ready);
  return ready;
}

export function markClosed(id: string): void {
  const t = readTunnel(id);
  if (t) writeTunnel({ ...t, status: 'closed' });
}

export function listTunnels(): Tunnel[] {
  const now = Date.now();
  purgeExpired(now);
  return readAllRaw().filter(t => isActive(t, now));
}

export type RelayCommand =
  | { kind: 'pop' }
  | { kind: 'ready'; id: string; port?: number }
  | { kind: 'list' }
  | { kind: 'hold'; sec: number }
  | { kind: 'reject'; reason: string };

// Fronteira de segurança: o desktop entra por chave SSH com forced-command
// `deck-tunnel relay`, e o que ele quer vem em SSH_ORIGINAL_COMMAND. Só estes verbos
// existem — `request`/`close` NÃO são alcançáveis pelo desktop. Vazio = conexão de
// dados (`ssh -N -R`): seguramos a sessão (bounded) pro forward viver.
export function parseRelayCommand(raw: string | undefined): RelayCommand {
  const cmd = (raw ?? '').trim();
  if (cmd === '' || cmd === 'hold') return { kind: 'hold', sec: MAX_TTL_SEC };
  const parts = cmd.split(/\s+/);
  switch (parts[0]) {
    case 'pop': return { kind: 'pop' };
    case 'list': return { kind: 'list' };
    case 'hold': {
      const sec = Math.min(Math.max(parseInt(parts[1] ?? '', 10) || MAX_TTL_SEC, 1), MAX_TTL_SEC);
      return { kind: 'hold', sec };
    }
    case 'ready': {
      if (!parts[1]) return { kind: 'reject', reason: 'ready exige <id>' };
      const port = parts[2] ? parseInt(parts[2], 10) : undefined;
      if (port !== undefined && (Number.isNaN(port) || port < PORT_MIN || port > PORT_MAX))
        return { kind: 'reject', reason: 'porta fora do range' };
      return { kind: 'ready', id: parts[1], port };
    }
    default: return { kind: 'reject', reason: `verbo não permitido: ${parts[0]}` };
  }
}

// Espera o desktop marcar `ready`. Resolve com o túnel pronto; rejeita se fechar,
// expirar ou estourar o timeout. Poll de arquivo — o caller (CLI) tem o sono.
export function pollOnce(id: string): { done: true; tunnel: Tunnel } | { done: false; reason?: string } {
  const t = readTunnel(id);
  if (!t) return { done: false, reason: 'sumiu' };
  if (t.status === 'ready') return { done: true, tunnel: t };
  if (t.status === 'closed') return { done: false, reason: 'fechado' };
  if (t.status === 'expired') return { done: false, reason: 'expirado' };
  return { done: false };
}

export const _internal = { baseDir, isActive, assignRemotePort, existsSync };
