import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { MIN_NODE_MAJOR } from '../shared/box-health';
import { isSupervised, QUIET_MS } from './self-update';
import { agentDir } from './self-update-boot';

// Boxes self-update their code but not the Node the setup put in ~/.deck-node.
// The claude CLI needs node>=22 since 2.1.198, so a box installed with Node 20 is
// moved to Node 22 here: download beside, verify, rebuild the native modules,
// swap, restart. A system Node is not ours to touch; the health check reports it.

export const NODE_DIST = `https://nodejs.org/dist/latest-v${MIN_NODE_MAJOR}.x`;
const DOWNLOAD_MS = 5 * 60_000;
const REBUILD_MS = 15 * 60_000;
const RETRY_AFTER_FAIL_MS = 24 * 60 * 60_000;

export type NodePlan = 'current' | 'disabled' | 'system-node' | 'not-owner' | 'unsupervised' | 'recent-failure' | 'upgrade';

export interface NodeFacts {
  version: string;
  execPath: string;
  home: string;
  uid: number;
  ownerUid: number | null;
  supervised: boolean;
  env: NodeJS.ProcessEnv;
  lastFailureAt: number | null;
  now: number;
}

export function nodeMajor(version: string): number {
  return Number(/^v?(\d+)/.exec(version)?.[1] ?? NaN);
}

export function planNodeUpgrade(f: NodeFacts): NodePlan {
  if (nodeMajor(f.version) >= MIN_NODE_MAJOR) return 'current';
  if (f.env.DECK_NODE_UPGRADE === 'off') return 'disabled';
  if (f.execPath !== join(f.home, '.deck-node', 'bin', 'node')) return 'system-node';
  if (f.ownerUid !== f.uid) return 'not-owner';
  if (!f.supervised) return 'unsupervised';
  if (f.lastFailureAt !== null && f.now - f.lastFailureAt < RETRY_AFTER_FAIL_MS) return 'recent-failure';
  return 'upgrade';
}

export function nodeArch(arch: string): string | null {
  return arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : null;
}

export function pickTarball(shasums: string, arch: string): { file: string; sha256: string } | null {
  const re = new RegExp(`^([0-9a-f]{64})\\s+(node-v\\d+\\.\\d+\\.\\d+-linux-${arch}\\.tar\\.gz)$`, 'm');
  const m = re.exec(shasums);
  return m ? { file: m[2], sha256: m[1] } : null;
}

export interface ExecResult { ok: boolean; stdout: string; stderr: string }

export interface UpgradeDeps {
  home: string;
  cwd: string;
  arch: string;
  fetchText: (url: string, timeoutMs: number) => Promise<string>;
  download: (url: string, dest: string, timeoutMs: number) => Promise<void>;
  sha256: (path: string) => Promise<string>;
  exec: (cmd: string, args: string[], o: { cwd?: string; timeoutMs: number; pathFront?: string }) => Promise<ExecResult>;
  rm: (p: string) => void;
  touch: (p: string) => void;
  mkdir: (p: string) => void;
  rename: (from: string, to: string) => void;
  exists: (p: string) => boolean;
  busy: () => boolean;
  markFailed: () => void;
  log: (m: string) => void;
}

export type UpgradeResult = 'swapped' | 'busy' | 'failed';

// Everything before the swap leaves the running Node untouched; a failed rebuild
// is rebuilt again with the old Node so node_modules matches what keeps running.
export async function upgradeNode(d: UpgradeDeps): Promise<UpgradeResult> {
  const live = join(d.home, '.deck-node');
  const next = join(d.home, '.deck-node.new');
  const old = join(d.home, '.deck-node.old');
  const tmp = join(d.home, '.deck-node.tgz');
  const fail = (why: string): UpgradeResult => {
    d.log(`[agent] node upgrade: ${why}`);
    d.rm(next); d.rm(tmp);
    d.markFailed();
    return 'failed';
  };
  const ready = join(next, '.deck-verified');
  const version = async () => {
    const v = await d.exec(join(next, 'bin', 'node'), ['-p', 'process.version'], { timeoutMs: 15_000 });
    return v.ok ? v.stdout.trim() : '';
  };
  // A previous tick that found turns running already left a verified copy beside.
  let ver = d.exists(ready) ? await version() : '';
  if (!(nodeMajor(ver) >= MIN_NODE_MAJOR)) {
    const arch = nodeArch(d.arch);
    if (!arch) return fail(`no official build for ${d.arch}`);
    let tar: { file: string; sha256: string } | null;
    try {
      tar = pickTarball(await d.fetchText(`${NODE_DIST}/SHASUMS256.txt`, DOWNLOAD_MS), arch);
      if (!tar) return fail(`linux-${arch} not listed in SHASUMS256.txt`);
      await d.download(`${NODE_DIST}/${tar.file}`, tmp, DOWNLOAD_MS);
    } catch (e) { return fail(`download failed: ${(e as Error).message}`); }
    if ((await d.sha256(tmp)) !== tar.sha256) return fail(`checksum mismatch for ${tar.file}`);
    d.rm(next);
    d.mkdir(next);
    const x = await d.exec('tar', ['-xzf', tmp, '-C', next, '--strip-components=1'], { timeoutMs: DOWNLOAD_MS });
    d.rm(tmp);
    if (!x.ok) return fail(`extract failed: ${x.stderr.slice(-200)}`);
    ver = await version();
    if (!(nodeMajor(ver) >= MIN_NODE_MAJOR)) return fail(`extracted node does not run (${ver || 'no output'})`);
    d.touch(ready);
  }
  // The rebuild replaces native modules the running process may load lazily
  // (node-pty on the first terminal): it happens only right before the restart.
  if (d.busy()) { d.log('[agent] node upgrade: downloaded, waiting for no turn in flight'); return 'busy'; }
  const rebuild = await d.exec(join(next, 'bin', 'npm'), ['rebuild'], { cwd: d.cwd, timeoutMs: REBUILD_MS, pathFront: join(next, 'bin') });
  if (!rebuild.ok) {
    await d.exec(join(live, 'bin', 'npm'), ['rebuild'], { cwd: d.cwd, timeoutMs: REBUILD_MS, pathFront: join(live, 'bin') });
    return fail(`npm rebuild on ${ver} failed: ${rebuild.stderr.trim().slice(-300)}`);
  }
  d.rm(old);
  d.rename(live, old);
  try { d.rename(next, live); }
  catch (e) { d.rename(old, live); return fail(`swap failed: ${(e as Error).message}`); }
  d.rm(old);
  d.rm(join(live, '.deck-verified'));
  d.log(`[agent] node upgrade: ${ver} in ${live}, restarting`);
  return 'swapped';
}

function failMarker(): string { return join(agentDir(), 'node-upgrade-failed'); }

function readFailure(): number | null {
  try { return Number(readFileSync(failMarker(), 'utf8')) || null; } catch { return null; }
}

function realDeps(cwd: string, busy: () => boolean): UpgradeDeps {
  return {
    home: homedir(), cwd, arch: process.arch,
    fetchText: async (url, ms) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    },
    download: async (url, dest, ms) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      await pipeline(Readable.fromWeb(r.body as never), createWriteStream(dest));
    },
    sha256: async (p) => {
      const h = createHash('sha256');
      await pipeline(createReadStream(p), h);
      return h.digest('hex');
    },
    exec: (cmd, args, o) => new Promise((resolve) => {
      const env = { ...process.env, PATH: o.pathFront ? `${o.pathFront}:${process.env.PATH ?? ''}` : process.env.PATH };
      execFile(cmd, args, { cwd: o.cwd, timeout: o.timeoutMs, env, maxBuffer: 16 * 1024 * 1024 },
        (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) }));
    }),
    rm: (p) => rmSync(p, { recursive: true, force: true }),
    touch: (p) => writeFileSync(p, ''),
    mkdir: (p) => mkdirSync(p, { recursive: true }),
    rename: renameSync,
    exists: existsSync,
    busy,
    markFailed: () => { try { mkdirSync(agentDir(), { recursive: true }); writeFileSync(failMarker(), String(Date.now())); } catch { /* best effort */ } },
    log: (m) => console.error(m),
  };
}

const BUSY_RECHECK_MS = 60_000;
const FIRST_RUN_MS = 45_000;

// Busy until the agent has had no turn in flight for QUIET_MS in a row.
export function quietBusy(busy: () => boolean, now: () => number = Date.now, quietMs = QUIET_MS): () => boolean {
  let idleSince: number | null = null;
  return () => {
    if (busy()) { idleSince = null; return true; }
    idleSince ??= now();
    return now() - idleSince < quietMs;
  };
}

export function startNodeUpgrade(p: { cwd: string; busy: () => boolean; restart: () => void }): void {
  const home = homedir();
  let execPath = process.execPath;
  try { execPath = realpathSync(process.execPath); } catch { /* keep as is */ }
  let ownerUid: number | null = null;
  try { ownerUid = statSync(join(home, '.deck-node')).uid; } catch { /* absent */ }
  const plan = planNodeUpgrade({
    version: process.version, execPath, home, uid: process.getuid?.() ?? -1, ownerUid,
    supervised: isSupervised(process.env), env: process.env, lastFailureAt: readFailure(), now: Date.now(),
  });
  if (plan === 'current') return;
  if (plan !== 'upgrade') { console.error(`[agent] node ${process.version} is below ${MIN_NODE_MAJOR}; not upgrading (${plan})`); return; }
  const deps = realDeps(p.cwd, quietBusy(p.busy));
  const run = async () => {
    const r = await upgradeNode(deps).catch((e): UpgradeResult => { console.error('[agent] node upgrade:', (e as Error).message); return 'failed'; });
    if (r === 'swapped') p.restart();
    else if (r === 'busy') setTimeout(run, BUSY_RECHECK_MS).unref();
  };
  setTimeout(run, FIRST_RUN_MS).unref();
}
