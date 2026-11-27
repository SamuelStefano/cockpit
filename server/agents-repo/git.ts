import { execFile } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { agentStateDir } from '../github-app';

export const repoDir = (): string => join(agentStateDir(), 'agents-repo');
const hooksDir = (): string => join(agentStateDir(), 'agents-repo-hooks');

export const DECK_AUTHOR = 'Deck';
export const DECK_EMAIL = 'deck@deck.local';

// No global/system config and an empty hooks dir on every call: nothing fetched
// from the remote (or planted in the clone) ever runs as a hook or filter.
// Symlinks in a fetched tree are checked out as plain files, submodules are never
// recursed, and every pathspec is literal.
function gitEnv(extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C', LC_ALL: 'C',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1', GIT_ASKPASS: '', SSH_ASKPASS: '',
    GIT_AUTHOR_NAME: DECK_AUTHOR, GIT_AUTHOR_EMAIL: DECK_EMAIL, GIT_COMMITTER_NAME: DECK_AUTHOR, GIT_COMMITTER_EMAIL: process.env.DECK_GIT_EMAIL || DECK_EMAIL,
    ...extra,
  };
}

export interface GitOpts { env?: NodeJS.ProcessEnv; timeoutMs?: number }

const HARDENING = ['core.fsmonitor=false', 'core.symlinks=false', 'core.quotePath=false', 'commit.gpgsign=false', 'protocol.ext.allow=never', 'submodule.recurse=false', 'fetch.recurseSubmodules=false'];
const STALE_LOCK_MS = 30_000;

// Every git call here is serialized by `locked` and capped well under this age,
// so an older index.lock belongs to a git that was killed mid-write.
function clearStaleLock(): boolean {
  const lock = join(repoDir(), '.git', 'index.lock');
  try {
    if (Date.now() - statSync(lock).mtimeMs < STALE_LOCK_MS) return false;
    rmSync(lock, { force: true });
    return true;
  } catch { return false; }
}

function run(args: string[], opts: GitOpts): Promise<string> {
  mkdirSync(hooksDir(), { recursive: true, mode: 0o700 });
  const argv = ['-c', `core.hooksPath=${hooksDir()}`, ...HARDENING.flatMap((c) => ['-c', c]), '-C', repoDir(), ...args];
  return new Promise((resolve, reject) => {
    execFile('git', argv, { env: gitEnv(opts.env ?? {}), timeout: opts.timeoutMs ?? 15_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }, (err, stdout) => {
      if (err) reject(new Error(`git ${args[0]} falhou`)); else resolve(stdout);
    });
  });
}

export function git(args: string[], opts: GitOpts = {}): Promise<string> {
  return run(args, opts).catch((e) => { if (clearStaleLock()) return run(args, opts); throw e; });
}

let chain: Promise<unknown> = Promise.resolve();

// One git operation at a time on the clone: concurrent saves would race the index.
export function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}
