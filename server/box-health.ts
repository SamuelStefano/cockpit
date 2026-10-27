import { execFile } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { ServerMsg } from '../shared/protocol';
import {
  evalAgentVersion, evalClaudeAuth, evalClaudeCli, evalDevices, evalDisk, evalNode, evalPty, evalSelfUpdate,
  type AgentVersionFacts, type BoxHealth, type ClaudeCliFacts, type SelfUpdateFacts,
} from '../shared/box-health';
import { claudeReady } from './admin-ops';
import { claudeCliInfo, deckInfo, REPO_ROOT } from './deck-ops';
import { cliPath } from './engine/cli-path';
import { authHold } from './ws/auth-health';
import { hasDevices, listDevices } from './e2e/devices';
import { selfUpdateStatus } from './self-update';

// Raw facts about this box. Every probe is bounded: one hung `claude --help` must
// not hold the report, so a probe that times out reports "unknown" for itself.
export interface HealthProbes {
  agent: () => Promise<AgentVersionFacts>;
  cli: () => Promise<ClaudeCliFacts>;
  auth: () => { ready: boolean; held: boolean };
  node: () => string;
  pty: () => Promise<{ ok: boolean; error: string }>;
  disk: () => Promise<number | null>;
  devices: () => number | null;
  selfUpdate: () => SelfUpdateFacts;
}

export const PROBE_TIMEOUT_MS = 15_000;

export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    t.unref?.();
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}

export async function evaluate(p: HealthProbes, now = Date.now(), timeoutMs = PROBE_TIMEOUT_MS): Promise<BoxHealth> {
  const [agent, cli, pty, disk] = await Promise.all([
    withTimeout(p.agent(), timeoutMs, { head: '', boot: '', behind: null }),
    withTimeout(p.cli(), timeoutMs, { path: '', version: '', help: '' }),
    withTimeout(p.pty(), timeoutMs, { ok: false, error: 'timeout' }),
    withTimeout(p.disk(), timeoutMs, null),
  ]);
  return {
    at: now,
    items: [
      evalClaudeCli(cli),
      evalClaudeAuth(p.auth()),
      evalAgentVersion(agent),
      evalSelfUpdate(p.selfUpdate()),
      evalNode(p.node()),
      evalPty(pty),
      evalDisk(disk),
      evalDevices(p.devices()),
    ],
  };
}

export function createHealthCache(collect: () => Promise<BoxHealth>, ttlMs: number, now = () => Date.now()) {
  let last: BoxHealth | null = null;
  let inflight: Promise<BoxHealth> | null = null;
  const refresh = (): Promise<BoxHealth> => {
    inflight ??= collect().then((h) => { last = h; return h; }).finally(() => { inflight = null; });
    return inflight;
  };
  return {
    get: (): Promise<BoxHealth> => (last && now() - last.at < ttlMs ? Promise.resolve(last) : refresh()),
    refresh,
    peek: () => last,
  };
}

function exec(cmd: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, env: { ...process.env, PATH: cliPath() }, maxBuffer: 1024 * 1024 }, (err, stdout) => resolve(err ? '' : String(stdout)));
  });
}

let ptyResult: Promise<{ ok: boolean; error: string }> | null = null;

const realProbes: HealthProbes = {
  agent: async () => {
    const [info, behind] = await Promise.all([
      deckInfo(),
      exec('git', ['-C', REPO_ROOT, 'rev-list', '--count', 'HEAD..origin/main'], 5_000),
    ]);
    const n = Number.parseInt(behind, 10);
    return { head: info.headCommit, boot: info.bootCommit, behind: Number.isFinite(n) ? n : null };
  },
  cli: async () => {
    const [info, help] = await Promise.all([claudeCliInfo(), exec('claude', ['--help'], 10_000)]);
    return { path: info.path, version: info.version, help };
  },
  auth: () => ({ ready: claudeReady(), held: authHold() }),
  node: () => process.version,
  pty: () => {
    ptyResult ??= import('node-pty').then(() => ({ ok: true, error: '' }), (e: Error) => ({ ok: false, error: e.message }));
    return ptyResult;
  },
  disk: async () => {
    const s = await statfs(homedir());
    return Number(s.bavail) * Number(s.bsize);
  },
  devices: () => {
    try {
      const n = listDevices().length;
      return n === 0 && hasDevices() ? null : n;
    } catch { return null; }
  },
  selfUpdate: () => selfUpdateStatus(),
};

const CACHE_MS = 60_000;
export const HEALTH_EVERY_MS = 5 * 60_000;

export const boxHealth = createHealthCache(() => evaluate(realProbes), CACHE_MS);

export function healthFrame(health: BoxHealth): ServerMsg {
  return { t: 'agent-health', health };
}

export function startHealthLoop(hasClients: () => boolean, emit: (msg: ServerMsg) => void): void {
  const tick = () => {
    if (!hasClients()) return;
    boxHealth.refresh().then((h) => emit(healthFrame(h))).catch(() => {});
  };
  setTimeout(tick, 5_000).unref();
  setInterval(tick, HEALTH_EVERY_MS).unref();
}
