import { execFile } from 'node:child_process';
import { addBad, agentDir, markerFile, npmBesideNode, readBad, realFs, writeMarker } from './self-update-boot';

// Keeps an installed agent on the code merged to `main` of the repo it was cloned
// from. The only source is that git remote, the same trust as the install itself:
// nothing the relay says can start, steer or skip an update.

export interface ExecResult { ok: boolean; stdout: string; stderr: string }
export type Exec = (cmd: string, args: string[], timeoutMs: number) => Promise<ExecResult>;

export interface SelfUpdateDeps {
  exec: Exec;
  now: () => number;
  busy: () => boolean;
  restart: () => void;
  log: (msg: string) => void;
  // Persisted across restarts (self-update-boot.ts): commits that failed, and the
  // marker the next boot counts against until the new code confirms itself.
  isBad: (sha: string) => boolean;
  markBad: (sha: string) => void;
  markPending: (from: string, to: string) => void;
  unconfirmed: () => boolean;
}

export interface SelfUpdateOptions {
  env?: NodeJS.ProcessEnv;
  npmBin?: string;
}

export type TickResult =
  | 'disabled' | 'skipped' | 'fetch-failed' | 'current' | 'diverged' | 'known-bad'
  | 'waiting' | 'merge-failed' | 'rolled-back' | 'restarting';

// A restart interrupts nobody: it waits for no turn in flight, for this long in a row.
export const QUIET_MS = 3 * 60_000;
const FETCH_MS = 90_000;
const GIT_MS = 30_000;
const NPM_MS = 15 * 60_000;
const GIT = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false'];
const DEP_FILES = ['package.json', 'package-lock.json'];

// Restarting needs something to bring the process back: systemd sets
// INVOCATION_ID, the setup's nohup loop sets DECK_SUPERVISED.
export function isSupervised(env: NodeJS.ProcessEnv): boolean {
  return !!env.INVOCATION_ID || env.DECK_SUPERVISED === '1';
}

export function createSelfUpdater(deps: SelfUpdateDeps, o: SelfUpdateOptions = {}) {
  const env = o.env ?? process.env;
  const npm = o.npmBin ?? 'npm';
  const git = (args: string[], ms = GIT_MS) => deps.exec('git', [...GIT, ...args], ms);
  let lastSkip = '';
  let idleSince: number | null = null;
  let done = false;
  let staged: { from: string; to: string } | null = null;

  const skip = (why: string): TickResult => {
    if (why !== lastSkip) deps.log(`[agent] self-update: skipped (${why})`);
    lastSkip = why;
    return 'skipped';
  };

  async function skipReason(): Promise<string | null> {
    if (!isSupervised(env)) return 'no supervisor to restart the agent';
    const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (!branch.ok) return 'not a git checkout';
    if (branch.stdout.trim() !== 'main') return `on branch ${branch.stdout.trim()}, not main`;
    // Read without our override: armed auto-redeploy hooks own updates on that clone.
    const hooks = await deps.exec('git', ['config', '--get', 'core.hooksPath'], GIT_MS);
    if (hooks.ok && hooks.stdout.trim()) return 'core.hooksPath set (auto-redeploy hooks own updates)';
    const status = await git(['status', '--porcelain', '--untracked-files=no']);
    if (!status.ok) return 'git status failed';
    if (status.stdout.trim()) return 'working tree has local changes';
    return null;
  }

  async function tick(): Promise<TickResult> {
    if (done) return 'restarting';
    if (staged) return restartWhenQuiet();
    if (env.DECK_SELF_UPDATE === 'off') { deps.log('[agent] self-update: off (DECK_SELF_UPDATE=off)'); return 'disabled'; }
    const why = await skipReason();
    if (!why && deps.unconfirmed()) return skip('previous update not confirmed yet');
    if (why) { idleSince = null; return skip(why); }
    lastSkip = '';

    if (!(await git(['fetch', '-q', 'origin', 'main'], FETCH_MS)).ok) return 'fetch-failed';
    const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();
    const target = (await git(['rev-parse', 'origin/main'])).stdout.trim();
    if (!head || !target || head === target) { idleSince = null; return 'current'; }
    if (!(await git(['merge-base', '--is-ancestor', head, target])).ok) { idleSince = null; return 'diverged'; }
    if (deps.isBad(target)) return 'known-bad';

    // Never restart over a running turn, however long it takes; a gap between two
    // turns is not enough either, the agent must stay idle for QUIET_MS.
    if (deps.busy()) { idleSince = null; return 'waiting'; }
    idleSince ??= deps.now();
    if (deps.now() - idleSince < QUIET_MS) return 'waiting';

    const changed = await git(['diff', '--name-only', head, target, '--', ...DEP_FILES]);
    if (!(await git(['merge', '--ff-only', '-q', target])).ok) {
      deps.log(`[agent] self-update: fast-forward to ${short(target)} failed; staying on ${short(head)}`);
      return 'merge-failed';
    }
    if (!changed.ok || changed.stdout.trim()) {
      const install = await deps.exec(npm, ['ci', '--no-audit', '--no-fund'], NPM_MS);
      if (!install.ok) {
        deps.log(`[agent] self-update: npm ci failed for ${short(target)}; rolling back to ${short(head)}: ${install.stderr.trim().slice(-400)}`);
        await git(['reset', '-q', '--hard', head]);
        // npm ci wipes node_modules first: reinstall the old lockfile so the next boot still runs.
        const restore = await deps.exec(npm, ['ci', '--no-audit', '--no-fund'], NPM_MS);
        if (!restore.ok) deps.log('[agent] self-update: restoring the previous dependencies failed too');
        deps.markBad(target);
        idleSince = null;
        return 'rolled-back';
      }
    }
    staged = { from: head, to: target };
    return restartWhenQuiet();
  }

  // The merge and npm ci can take minutes: a turn may start meanwhile. The new code
  // is already on disk, so later ticks only wait to restart (HEAD equals origin/main
  // by then and the normal path would read 'current' and never restart).
  function restartWhenQuiet(): TickResult {
    if (!staged) return 'current';
    if (deps.busy()) { idleSince = null; return 'waiting'; }
    idleSince ??= deps.now();
    if (deps.now() - idleSince < QUIET_MS) return 'waiting';
    done = true;
    deps.markPending(staged.from, staged.to);
    deps.log(`[agent] self-update: ${short(staged.from)}..${short(staged.to)}, restarting`);
    deps.restart();
    return 'restarting';
  }

  return { tick, reason: () => lastSkip };
}

function short(sha: string): string { return sha.slice(0, 7); }

export function execIn(cwd: string): Exec {
  return (cmd, args, timeoutMs) => new Promise((resolve) => {
    execFile(cmd, args, {
      cwd, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    }, (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) }));
  });
}

export const FIRST_CHECK_MS = 60_000;
export const CHECK_EVERY_MS = 10 * 60_000;
const JITTER_MS = 2 * 60_000;
const RECHECK_WAITING_MS = 60_000;

let lastStatus: { result: TickResult | null; reason: string } = { result: null, reason: '' };

// Read by the machine health report (server/box-health.ts).
export function selfUpdateStatus(): { result: TickResult | null; reason: string } {
  return lastStatus;
}

export function startSelfUpdate(p: { cwd: string; busy: () => boolean; restart: () => void }): void {
  const dir = agentDir();
  const updater = createSelfUpdater({
    exec: execIn(p.cwd), now: Date.now, busy: p.busy, restart: p.restart, log: (m) => console.error(m),
    isBad: (sha) => readBad(realFs, dir).includes(sha),
    markBad: (sha) => addBad(realFs, dir, sha),
    markPending: (from, to) => writeMarker(realFs, dir, { from, to, boots: 0 }),
    unconfirmed: () => realFs.read(markerFile(dir)) !== null,
  }, { npmBin: npmBesideNode() });
  const schedule = (ms: number) => setTimeout(run, ms).unref();
  const run = async () => {
    let r: TickResult;
    try { r = await updater.tick(); } catch (e) { console.error('[agent] self-update:', (e as Error).message); r = 'fetch-failed'; }
    lastStatus = { result: r, reason: updater.reason() };
    if (r === 'disabled' || r === 'restarting') return;
    schedule(r === 'waiting' ? RECHECK_WAITING_MS : CHECK_EVERY_MS + Math.floor(Math.random() * JITTER_MS));
  };
  schedule(FIRST_CHECK_MS + Math.floor(Math.random() * 15_000));
}
