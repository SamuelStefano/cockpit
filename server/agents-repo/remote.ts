import { dirname, extname, basename } from 'node:path';
import type { TeamBot, WsConflict, WsRepoStatus } from '../../shared/protocol';
import { isBotSettingsPath } from '../../shared/bot-settings';
import { fetchGithubTokens, withGithubCredentialHelper, type GithubToken } from '../github-app';
import { unsafeRelPath, writeBotFile } from '../team-files';
import { git, locked } from './git';
import { ensureRepo, headStatus, isVersioned, mirrorBotUnlocked, onCommitted } from './history';

export const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const RETRY_MS = 60_000;
const SYNC_MS = 10 * 60_000;
// A push that keeps failing (revoked access, GitHub down) backs off to the sync cadence.
export const retryDelay = (failures: number): number => Math.min(RETRY_MS * 2 ** Math.max(0, failures - 1), SYNC_MS);
const REMOTE_TIMEOUT_MS = 60_000;
const FETCH_DEPTH = 50;
export const MAX_REPO_KB = 50 * 1024;

type Bots = Pick<TeamBot, 'id' | 'name'>[];
let pending = false;
let failures = 0;
let retry: NodeJS.Timeout | undefined;
let lastConflicts: WsConflict[] = [];

export const validRepoName = (repo: unknown): repo is string => typeof repo === 'string' && repo.length <= 200 && REPO_RE.test(repo) && !repo.split('/').some((s) => s === '.' || s === '..');
const githubUrl = (repo: string) => `https://github.com/${repo}.git`;
// The token only ever reaches git through the credential helper, never the URL or argv.
const remoteEnv = () => withGithubCredentialHelper({});
const remoteGit = (args: string[]) => git(args, { env: remoteEnv(), timeoutMs: REMOTE_TIMEOUT_MS });

async function configuredRepo(): Promise<string | undefined> {
  const r = (await git(['config', '--get', 'deck.repo']).catch(() => '')).trim();
  return validRepoName(r) ? r : undefined;
}

export async function repoStatus(): Promise<WsRepoStatus> {
  const [head, repo] = await Promise.all([headStatus().catch(() => ({})), configuredRepo()]);
  return { ...head, ...(repo ? { repo, pending } : {}) };
}

export const currentConflicts = (): WsConflict[] => lastConflicts;

async function pushUnlocked(): Promise<boolean> {
  if (!(await configuredRepo())) return false;
  try {
    await remoteGit(['push', '-q', 'origin', 'HEAD:refs/heads/main']);
    pending = false;
    failures = 0;
    return true;
  } catch {
    pending = true;
    failures += 1;
    if (!retry) { retry = setTimeout(() => { retry = undefined; void pushQueued(); }, retryDelay(failures)); retry.unref(); }
    return false;
  }
}

// Fire-and-forget after every commit: an offline box keeps committing and the
// queued push retries every minute. A save never waits on the network.
export const pushQueued = (): Promise<boolean> => locked(pushUnlocked).catch(() => false);
onCommitted(() => { void pushQueued(); });

async function blob(spec: string): Promise<string | null> {
  return (await git(['rev-parse', '--verify', '-q', spec]).catch(() => '')).trim() || null;
}

async function names(args: string[]): Promise<string[]> {
  return (await git(args).catch(() => '')).split('\n').filter(Boolean);
}

export function remoteCopyPath(rel: string): string {
  const flat = isBotSettingsPath(rel) ? `claude-${basename(rel)}` : rel;
  const ext = extname(flat);
  const dir = dirname(flat);
  const stem = basename(flat, ext);
  return `${dir === '.' ? '' : `${dir}/`}${stem}.remote${ext}`;
}

function splitPath(p: string, bots: Bots): { bot: Bots[number]; rel: string } | null {
  const i = p.indexOf('/');
  if (i <= 0) return null;
  const bot = bots.find((b) => b.id === p.slice(0, i));
  const rel = p.slice(i + 1);
  return bot && !unsafeRelPath(rel) && isVersioned(rel) ? { bot, rel } : null;
}

// Only a regular file is ever copied into a workspace: a symlink or submodule entry
// in the remote tree would otherwise land as text naming a path outside it.
const regularBlob = async (rev: string, p: string): Promise<boolean> => /^100(644|755) blob /.test(await git(['ls-tree', rev, '--', p]).catch(() => ''));

// `-X ours` leaves modify/delete and file/folder clashes unmerged: the Deck side wins those too.
async function keepOurs(pre: string): Promise<boolean> {
  const unmerged = await names(['diff', '--name-only', '--diff-filter=U']);
  if (!unmerged.length) return false;
  try {
    for (const p of unmerged) await git((await blob(`${pre}:${p}`)) ? ['checkout', pre, '--', p] : ['rm', '-q', '-f', '--', p]);
    await git(['commit', '-q', '--no-edit']);
    return true;
  } catch { return false; }
}

export interface ListDeps { tokens?: () => Promise<GithubToken[]>; fetchImpl?: typeof fetch }

// GitHub reports `size` in KB. Null = could not be read.
export async function repoSizeKb(repo: string, deps: ListDeps = {}): Promise<number | null> {
  const { tokens = fetchGithubTokens, fetchImpl = fetch } = deps;
  const all = await tokens().catch(() => []);
  const owner = repo.split('/')[0].toLowerCase();
  const t = all.find((x) => x.account_login.toLowerCase() === owner) ?? (all.length === 1 ? all[0] : undefined);
  if (!t) return null;
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}`, { headers: { authorization: `Bearer ${t.token}`, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const size = ((await res.json()) as { size?: unknown }).size;
    return typeof size === 'number' && size >= 0 ? size : null;
  } catch { return null; }
}

let sizeProbe: (repo: string) => Promise<number | null> = repoSizeKb;
export function setRepoSizeProbe(fn: (repo: string) => Promise<number | null>): void { sizeProbe = fn; }

// The box disk is small: nothing is fetched from a repo whose size is unknown or over the cap.
export async function sizeRefusal(repo: string): Promise<string | undefined> {
  const kb = await sizeProbe(repo).catch(() => null);
  if (kb === null) return 'não foi possível conferir o tamanho do repositório no GitHub';
  return kb > MAX_REPO_KB ? `Repositório grande demais para sincronizar (${Math.ceil(kb / 1024)} MB, limite 50 MB)` : undefined;
}

export type SyncResult = { conflicts: WsConflict[] } | { error: string };

async function syncUnlocked(bots: Bots): Promise<SyncResult> {
  const repo = await configuredRepo();
  if (!repo) return { conflicts: [] };
  const refused = await sizeRefusal(repo);
  if (refused) return { error: refused };
  await ensureRepo();
  // A merge cut short by a killed git would block every later commit.
  await git(['merge', '--abort']).catch(() => '');
  for (const b of bots) await mirrorBotUnlocked(b.id, b.name).catch(() => false);
  const heads = await remoteGit(['ls-remote', '--heads', 'origin', 'main']).catch(() => null);
  if (heads === null) { pending = true; return { error: 'GitHub indisponível; as versões ficam locais até a próxima sincronização' }; }
  const conflicts: WsConflict[] = [];
  if (heads.trim()) {
    // Shallow only on the first fetch: a depth on a later one would graft away the
    // local commits already pushed and cut the Versões list short.
    const first = !(await blob('refs/remotes/origin/main'));
    try { await remoteGit(['fetch', '-q', '--no-tags', ...(first ? [`--depth=${FETCH_DEPTH}`] : []), 'origin', 'refs/heads/main:refs/remotes/origin/main']); } catch { pending = true; return { error: 'não foi possível buscar o GitHub' }; }
    const pre = await blob('HEAD');
    const base = pre ? (await git(['merge-base', 'HEAD', 'origin/main']).catch(() => '')).trim() : '';
    const remoteChanged = base ? await names(['diff', '--name-only', base, 'origin/main']) : await names(['ls-tree', '-r', '--name-only', 'origin/main']);
    const localChanged = new Set(!pre ? [] : base ? await names(['diff', '--name-only', base, 'HEAD']) : await names(['ls-tree', '-r', '--name-only', 'HEAD']));
    const both: string[] = [];
    for (const p of remoteChanged) if (localChanged.has(p) && (await blob(`HEAD:${p}`)) !== (await blob(`origin/main:${p}`))) both.push(p);
    if (!pre) await git(['reset', '-q', '--hard', 'origin/main']);
    else {
      try {
        await git(['merge', '-q', '--no-edit', '--allow-unrelated-histories', '-X', 'ours', '-m', 'Deck: sincronizar com o GitHub', 'origin/main']);
      } catch {
        if (!(await keepOurs(pre))) {
          await git(['merge', '--abort']).catch(() => '');
          return { error: 'não foi possível juntar as versões do GitHub' };
        }
      }
      for (const p of both) await git(['checkout', pre, '--', p]).catch(() => '');
      if (both.length && (await names(['diff', '--cached', '--name-only'])).length) await git(['commit', '-q', '-m', 'Deck: manter a versão do Deck nos conflitos']);
    }
    for (const p of remoteChanged) {
      const hit = splitPath(p, bots);
      if (!hit || !(await regularBlob('origin/main', p))) continue;
      const remote = await git(['show', `origin/main:${p}`]).catch(() => null);
      if (remote === null) continue;
      const conflict = both.includes(p);
      // Settings from the repo may only add deny/ask rules; anything wider waits for the admin as a copy.
      const w = conflict ? { error: 'conflito' } : await writeBotFile(hit.bot.id, hit.rel, remote, undefined, { admin: !isBotSettingsPath(hit.rel) });
      if (!('error' in w)) continue;
      const copy = await writeBotFile(hit.bot.id, remoteCopyPath(hit.rel), remote, undefined, { admin: true });
      if (!('error' in copy)) conflicts.push({ botId: hit.bot.id, path: hit.rel });
    }
  }
  await pushUnlocked();
  lastConflicts = conflicts;
  return { conflicts };
}

export const syncAll = (bots: Bots): Promise<SyncResult> => locked(() => syncUnlocked(bots)).catch(() => ({ error: 'falha ao sincronizar' }));

export interface ConnectOpts { url?: string; listRepos?: () => Promise<string[]> }

// Admin/root only (frames). The repo must be one the GitHub App installation can reach.
export async function connectRepo(repo: unknown, bots: Bots, opts: ConnectOpts = {}): Promise<SyncResult> {
  if (!validRepoName(repo)) return { error: 'repositório inválido' };
  if (!opts.url) {
    const allowed = await (opts.listRepos ?? listInstallationRepos)().catch(() => []);
    if (!allowed.some((r) => r.toLowerCase() === repo.toLowerCase())) return { error: 'o app do GitHub não tem acesso a esse repositório' };
  }
  const refused = await sizeRefusal(repo);
  if (refused) return { error: refused };
  const url = opts.url ?? githubUrl(repo);
  const set = await locked(async () => {
    await ensureRepo();
    const has = (await git(['remote']).catch(() => '')).split('\n').includes('origin');
    await git(has ? ['remote', 'set-url', 'origin', url] : ['remote', 'add', 'origin', url]);
    await git(['config', 'deck.repo', repo]);
    return true;
  }).catch(() => false);
  if (!set) return { error: 'não foi possível configurar o repositório' };
  startSyncTimer(async () => bots);
  return syncAll(bots);
}

// Installation tokens cannot create a repo under a user account, so the user
// picks one the installation was granted (e.g. a `deck-agents` they created).
export async function listInstallationRepos(deps: ListDeps = {}): Promise<string[]> {
  const { tokens = fetchGithubTokens, fetchImpl = fetch } = deps;
  const out = new Set<string>();
  for (const t of await tokens()) {
    try {
      const res = await fetchImpl('https://api.github.com/installation/repositories?per_page=100', {
        headers: { authorization: `Bearer ${t.token}`, accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { repositories?: { full_name?: unknown }[] };
      for (const r of body.repositories ?? []) if (validRepoName(r.full_name)) out.add(r.full_name);
    } catch { /* one installation down never hides the others */ }
  }
  return [...out].sort((a, b) => Number(b.endsWith('/deck-agents')) - Number(a.endsWith('/deck-agents')) || a.localeCompare(b));
}

let timer: NodeJS.Timeout | undefined;
export function startSyncTimer(getBots: () => Promise<Bots>): void {
  if (timer) return;
  timer = setInterval(() => { void getBots().then((b) => syncAll(b)).catch(() => undefined); }, SYNC_MS);
  timer.unref();
}
