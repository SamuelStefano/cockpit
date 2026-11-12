import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AgentSource, AgentSourceSync, TeamBot } from '../shared/protocol';
import { validateAgentSource } from '../shared/agent-source';
import { resolveAgentDir, sourceCloneDir } from './agent-dir';
import { withGithubCredentialHelper } from './github-app';
import { setSourceSync } from './team';

const run = promisify(execFile);
const GIT_TIMEOUT_MS = 90_000;
// "Pull on session start" without paying a fetch on every message of a busy thread.
export const SYNC_TTL_MS = 5 * 60_000;


export function repoUrl(source: AgentSource): string {
  return `https://github.com/${source.repo}.git`;
}

// Credentials come from what the box already has (the Deck's GitHub App helper,
// then the gh login in the global git config): nothing reaches argv or the browser.
// Symlinks are checked out as plain files and hooks are off, so the clone cannot
// point outside itself nor run code on fetch.
export function gitEnv(): NodeJS.ProcessEnv {
  return withGithubCredentialHelper({ PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C', GIT_TERMINAL_PROMPT: '0' });
}
const SAFE = ['-c', 'core.symlinks=false', '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always'];

export type GitRunner = (args: string[], cwd?: string) => Promise<string>;
const realGit: GitRunner = async (args, cwd) => (await run('git', [...SAFE, ...args], { cwd, env: gitEnv(), timeout: GIT_TIMEOUT_MS, maxBuffer: 1024 * 1024 })).stdout.trim();

// Mirrors `main` of the repo into the bot's clone, sparse on the agent's folder.
// A local edit in the clone is discarded on purpose: the repo is the source of truth.
export async function syncAgentSource(botId: string, source: AgentSource, git: GitRunner = realGit): Promise<AgentSourceSync> {
  const clone = sourceCloneDir(botId);
  const v = validateAgentSource(source);
  if (!clone || !v.ok) return { at: Date.now(), error: v.ok ? 'bot inválido' : v.error };
  const src = v.source;
  // Concurrent turns of the same bot share one sync instead of racing in one clone.
  const running = inFlight.get(clone);
  if (running) return running;
  const p = (async (): Promise<AgentSourceSync> => {
    try {
      const url = repoUrl(src);
      let origin = '';
      if (existsSync(join(clone, '.git'))) origin = await git(['remote', 'get-url', 'origin'], clone).catch(() => '');
      if (origin !== url) {
        await rm(clone, { recursive: true, force: true });
        await mkdir(clone, { recursive: true });
        await git(['init', '-q', '-b', 'main'], clone);
        await git(['remote', 'add', 'origin', url], clone);
      }
      await git(['sparse-checkout', 'set', '--no-cone', src.path ? `/${src.path}/` : '/*'], clone);
      await git(['fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', 'main'], clone);
      await git(['reset', '-q', '--hard', 'FETCH_HEAD'], clone);
      await git(['clean', '-qffdx'], clone);
      const commit = await git(['rev-parse', '--short', 'HEAD'], clone);
      if (!resolveAgentDir(botId, src)) return { at: Date.now(), commit, error: `pasta "${src.path}" não existe na main` };
      return { at: Date.now(), commit };
    } catch (e) {
      return { at: Date.now(), error: gitError(e) };
    }
  })();
  inFlight.set(clone, p);
  try { return await p; } finally { inFlight.delete(clone); }
}
const inFlight = new Map<string, Promise<AgentSourceSync>>();

// Never echo git's stderr verbatim: it can carry the URL with credentials in it.
export function gitError(e: unknown): string {
  const msg = String((e as { stderr?: string })?.stderr ?? (e as Error)?.message ?? '');
  if (/not found|Repository not found|could not read Username|Authentication failed|403/i.test(msg)) return 'repositório não encontrado ou sem acesso';
  if (/couldn't find remote ref|unknown revision/i.test(msg)) return 'o repositório não tem branch main';
  if (/timed out|ETIMEDOUT|SIGTERM/i.test(msg)) return 'o GitHub demorou demais, tente de novo';
  return 'não deu pra sincronizar o repositório';
}

export function syncIsFresh(bot: Pick<TeamBot, 'sourceSync'>, now = Date.now()): boolean {
  const s = bot.sourceSync;
  return !!s && !s.error && now - s.at < SYNC_TTL_MS;
}

// Syncs a repo-backed bot when its last sync is stale (or always, with `force`) and
// records the result. Returns the new team list when it changed, for the broadcast.
export async function refreshAgentSource(bot: TeamBot | undefined, force = false, git?: GitRunner): Promise<TeamBot[] | null> {
  if (!bot?.source || (!force && syncIsFresh(bot))) return null;
  const sync = await syncAgentSource(bot.id, bot.source, git);
  return setSourceSync(bot.id, sync);
}
