import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { agentStateDir } from '../github-app';

export const repoDir = (): string => join(agentStateDir(), 'agents-repo');
const hooksDir = (): string => join(agentStateDir(), 'agents-repo-hooks');

export const DECK_AUTHOR = 'Deck';
export const DECK_EMAIL = 'deck@deck.local';

// No global/system config and an empty hooks dir on every call: nothing fetched
// from the remote (or planted in the clone) ever runs as a hook or filter.
function gitEnv(extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C', LC_ALL: 'C',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '',
    GIT_AUTHOR_NAME: DECK_AUTHOR, GIT_AUTHOR_EMAIL: DECK_EMAIL, GIT_COMMITTER_NAME: DECK_AUTHOR, GIT_COMMITTER_EMAIL: process.env.DECK_GIT_EMAIL || DECK_EMAIL,
    ...extra,
  };
}

export interface GitOpts { env?: NodeJS.ProcessEnv; timeoutMs?: number }

export function git(args: string[], opts: GitOpts = {}): Promise<string> {
  mkdirSync(hooksDir(), { recursive: true, mode: 0o700 });
  const argv = ['-c', `core.hooksPath=${hooksDir()}`, '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false', '-c', 'protocol.ext.allow=never', '-C', repoDir(), ...args];
  return new Promise((resolve, reject) => {
    execFile('git', argv, { env: gitEnv(opts.env ?? {}), timeout: opts.timeoutMs ?? 15_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }, (err, stdout) => {
      if (err) reject(new Error(`git ${args[0]} falhou`)); else resolve(stdout);
    });
  });
}

let chain: Promise<unknown> = Promise.resolve();

// One git operation at a time on the clone: concurrent saves would race the index.
export function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}
