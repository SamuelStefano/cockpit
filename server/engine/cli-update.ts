import { execFile } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { cliPath, managedPrefix, resolveCli, setPreferredCliDir } from './cli-path';

// Keeps the one CLI the Deck spawns at npm's latest, in the managed prefix. Running
// turns keep the binary they started with; every new spawn resolves the new one.

export const CLI_PACKAGE = '@anthropic-ai/claude-code';

export interface CliExecResult { ok: boolean; stdout: string; stderr: string }
export type CliExec = (cmd: string, args: string[], timeoutMs: number) => Promise<CliExecResult>;

export interface CliUpdaterDeps {
  exec: CliExec;
  now: () => number;
  busy: () => boolean;
  env: NodeJS.ProcessEnv;
  npmBin: string;
  prefix: string;
  resolve: () => string;
  realpath: (p: string) => string;
  candidates: () => string[];
  prefer: (dir: string | null) => void;
  log: (msg: string) => void;
}

export interface CliUpdateResult { ok: boolean; from: string; to: string; message: string }
export type CliCheckResult = 'disabled' | 'current' | 'waiting' | 'updated' | 'failed' | 'offline';

const VERSION_MS = 15_000;
const NPM_VIEW_MS = 20_000;
const NPM_INSTALL_MS = 10 * 60_000;
const NATIVE_UPDATE_MS = 3 * 60_000;
// A failed update is not retried by every turn that hits the version error.
export const FAIL_COOLDOWN_MS = 10 * 60_000;
// The swap only touches the disk, so a box that is never idle still gets it.
export const MAX_BUSY_WAIT_MS = 2 * 60 * 60_000;

export function parseCliVersion(stdout: string): string {
  return /(\d+\.\d+\.\d+)/.exec(stdout)?.[1] ?? '';
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function isNativeInstall(realPath: string): boolean {
  return realPath.includes('/.local/share/claude/versions/');
}

export function autoUpdateOff(env: NodeJS.ProcessEnv): boolean {
  return env.DECK_CLI_AUTOUPDATE === 'off';
}

export function createCliUpdater(deps: CliUpdaterDeps) {
  let inflight: Promise<CliUpdateResult> | null = null;
  let lastFailure: { at: number; result: CliUpdateResult } | null = null;
  let busySince: number | null = null;

  const versionOf = async (bin: string) =>
    bin ? parseCliVersion((await deps.exec(bin, ['--version'], VERSION_MS)).stdout) : '';

  async function installed(): Promise<{ path: string; version: string }> {
    const path = deps.resolve();
    return { path, version: await versionOf(path) };
  }

  async function latest(): Promise<string> {
    const r = await deps.exec(deps.npmBin, ['view', CLI_PACKAGE, 'version'], NPM_VIEW_MS);
    return r.ok ? parseCliVersion(r.stdout) : '';
  }

  const realOf = (p: string) => { try { return deps.realpath(p); } catch { return p; } };

  // npm out of reach: the newest binary already on the box is still better than
  // the one the agent runs (two installs, the managed one never updated).
  async function preferNewest(current: string): Promise<string | null> {
    let best: { path: string; version: string } | null = null;
    for (const path of deps.candidates()) {
      const version = await versionOf(path);
      if (!version) continue;
      if (!best || compareVersions(version, best.version) > 0) best = { path, version };
    }
    if (!best || (current && compareVersions(best.version, current) <= 0)) return null;
    deps.prefer(dirname(best.path));
    deps.log(`[agent] claude CLI: using ${best.path} (${best.version}), newer than ${current || 'the managed one'}`);
    return best.version;
  }

  async function doUpdate(reason: string, required: string | null): Promise<CliUpdateResult> {
    const before = await installed();
    // Without a known minimum, only a newer binary can fix the refusal.
    const enough = (v: string) => !!v && (required
      ? compareVersions(v, required) >= 0
      : !before.version || compareVersions(v, before.version) > 0);
    if (before.path && isNativeInstall(realOf(before.path))) {
      await deps.exec(before.path, ['update'], NATIVE_UPDATE_MS);
      const v = await versionOf(before.path);
      if (enough(v)) {
        deps.log(`[agent] claude CLI: ${before.version || '?'} -> ${v} (native update, ${reason})`);
        return { ok: true, from: before.version, to: v, message: `Claude Code ${v}` };
      }
    }
    const r = await deps.exec(
      deps.npmBin,
      ['install', '-g', '--prefix', deps.prefix, '--no-audit', '--no-fund', `${CLI_PACKAGE}@latest`],
      NPM_INSTALL_MS,
    );
    if (r.ok) deps.prefer(null);
    const after = await installed();
    if (r.ok && enough(after.version)) {
      deps.log(`[agent] claude CLI: ${before.version || '?'} -> ${after.version} at ${after.path} (${reason})`);
      return { ok: true, from: before.version, to: after.version, message: `Claude Code ${after.version}` };
    }
    const fallback = await preferNewest(after.version);
    if (fallback && enough(fallback)) {
      return { ok: true, from: before.version, to: fallback, message: `Claude Code ${fallback}` };
    }
    const why = !r.ok
      ? `npm install falhou: ${(r.stderr.trim().split('\n').pop() ?? '').slice(0, 160)}`
      : `o npm entregou ${after.version || '?'}${required ? `, abaixo da ${required} exigida` : ''}`;
    deps.log(`[agent] claude CLI: update failed (${reason}): ${why}`);
    return { ok: false, from: before.version, to: after.version, message: why };
  }

  // Single-flight: every turn that hits the version error waits on the same install.
  function update(reason: string, required: string | null = null): Promise<CliUpdateResult> {
    if (inflight) return inflight;
    if (lastFailure && deps.now() - lastFailure.at < FAIL_COOLDOWN_MS) return Promise.resolve(lastFailure.result);
    inflight = doUpdate(reason, required)
      .catch((e): CliUpdateResult => ({ ok: false, from: '', to: '', message: (e as Error).message.slice(0, 160) }))
      .then((res) => {
        lastFailure = res.ok ? null : { at: deps.now(), result: res };
        return res;
      })
      .finally(() => { inflight = null; });
    return inflight;
  }

  async function heal(required: string | null): Promise<CliUpdateResult> {
    if (autoUpdateOff(deps.env)) {
      return { ok: false, from: '', to: '', message: 'a atualização automática está desligada (DECK_CLI_AUTOUPDATE=off)' };
    }
    return update('model-error', required);
  }

  async function check(): Promise<CliCheckResult> {
    if (autoUpdateOff(deps.env)) return 'disabled';
    const cur = await installed();
    const want = await latest();
    if (!want) {
      await preferNewest(cur.version);
      return 'offline';
    }
    if (cur.version && compareVersions(cur.version, want) >= 0) { busySince = null; return 'current'; }
    if (deps.busy()) {
      busySince ??= deps.now();
      if (deps.now() - busySince < MAX_BUSY_WAIT_MS) return 'waiting';
    }
    busySince = null;
    return (await update('behind', want)).ok ? 'updated' : 'failed';
  }

  async function report(): Promise<string> {
    const cur = await installed();
    const line = `[agent] claude CLI: ${cur.path || 'not found'} ${cur.version || '(no version)'} (managed prefix ${deps.prefix})`;
    deps.log(line);
    return line;
  }

  return { installed, latest, update, heal, check, report };
}

export type CliUpdater = ReturnType<typeof createCliUpdater>;

export function execCli(env: () => NodeJS.ProcessEnv): CliExec {
  return (cmd, args, timeoutMs) => new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: env() },
      (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) }));
  });
}

export function cliEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: cliPath(), NPM_CONFIG_PREFIX: managedPrefix(), TERM: 'dumb' };
}

function npmBin(): string {
  const beside = join(dirname(process.execPath), 'npm');
  return existsSync(beside) ? beside : 'npm';
}

// Every `claude` binary on the box: the managed prefix, the native install, npm's
// default prefix next to node (where `claude update` used to land) and the PATH.
function candidateBins(): string[] {
  const home = homedir();
  const dirs = [
    join(managedPrefix(home), 'bin'), join(home, '.local', 'bin'), join(home, '.claude', 'local'),
    dirname(process.execPath), ...(process.env.PATH ?? '').split(':'),
  ];
  return [...new Set(dirs.filter(Boolean).map((d) => join(d, 'claude')))].filter((p) => existsSync(p));
}

let busyFn: () => boolean = () => false;
let singleton: CliUpdater | null = null;

export function cliUpdater(): CliUpdater {
  singleton ??= createCliUpdater({
    exec: execCli(cliEnv), now: Date.now, busy: () => busyFn(), env: process.env,
    npmBin: npmBin(), prefix: managedPrefix(), resolve: () => resolveCli(),
    realpath: realpathSync, candidates: candidateBins, prefer: setPreferredCliDir,
    log: (m) => console.error(m),
  });
  return singleton;
}

export const FIRST_CLI_CHECK_MS = 20_000;
export const CLI_CHECK_EVERY_MS = 4 * 60 * 60_000;
const CLI_JITTER_MS = 30 * 60_000;
const CLI_RECHECK_BUSY_MS = 5 * 60_000;

export function startCliAutoUpdate(p: { busy: () => boolean }): void {
  busyFn = p.busy;
  const u = cliUpdater();
  void u.report().catch(() => {});
  const schedule = (ms: number) => setTimeout(run, ms).unref();
  const run = async () => {
    let r: CliCheckResult;
    try { r = await u.check(); } catch (e) { console.error('[agent] claude CLI check:', (e as Error).message); r = 'failed'; }
    if (r === 'disabled') { console.error('[agent] claude CLI: auto-update off (DECK_CLI_AUTOUPDATE=off)'); return; }
    if (r === 'updated') void u.report().catch(() => {});
    schedule(r === 'waiting' ? CLI_RECHECK_BUSY_MS : CLI_CHECK_EVERY_MS + Math.floor(Math.random() * CLI_JITTER_MS));
  };
  schedule(FIRST_CLI_CHECK_MS + Math.floor(Math.random() * 10_000));
}
