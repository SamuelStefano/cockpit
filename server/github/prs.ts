import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { CONFIG } from '../config';
import { mergeBlocker, mergeConfirmText, needsMergeConfirm, PR_URL_RE, type PrDetail, type PrSummary, type PrsSnapshot } from '../../shared/prs';
import { DETAIL_QUERY, detailFromResource, PAGE_SIZE, prFromNode, SEARCH_QUERY, searchPage, type SearchMode } from './prs-parse';
import { indexPrSessions, peekPrSessions } from './pr-sessions';

const run = promisify(execFile);

// The box's own `gh` login is the identity: no token ever leaves the server, and a
// box whose owner never ran `gh auth login` just shows the error state.
const GH_TIMEOUT_MS = 30_000;
const SNAPSHOT_TTL_MS = 60_000;
export const MERGED_SINCE_DAYS = 30;
const OPEN_PAGES = 5;
const MERGED_PAGES = 3;

export type Gh = (args: string[]) => Promise<string>;

const realGh: Gh = async (args) => {
  // cwd outside any repo: `gh pr merge --delete-branch` would otherwise try to
  // switch/delete a local branch of whatever checkout the server runs in.
  const { stdout } = await run('gh', args, { cwd: tmpdir(), timeout: GH_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' } });
  return stdout;
};

let gh: Gh = realGh;
export const runGh: Gh = (args) => gh(args);
export function setGhForTest(fn: Gh | null): void { justMerged.clear(); gh = fn ?? realGh; cache = null; inflight = null; login = null; diskLoaded = false; }

export async function graphql(query: string, vars: Record<string, string | number>): Promise<unknown> {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [k, v] of Object.entries(vars)) args.push(typeof v === 'number' ? '-F' : '-f', `${k}=${v}`);
  return JSON.parse(await gh(args));
}

async function search(q: string, mode: SearchMode, pages: number): Promise<{ prs: PrSummary[]; truncated: boolean }> {
  const prs: PrSummary[] = [];
  let after: string | null = null;
  for (let i = 0; i < pages; i++) {
    const vars: Record<string, string | number> = { q, first: PAGE_SIZE[mode] };
    if (after) vars.after = after;
    const page = searchPage(await graphql(SEARCH_QUERY(mode), vars));
    for (const n of page.nodes) { const pr = prFromNode(n); if (pr) prs.push(pr); }
    after = page.next;
    if (!after) break;
  }
  return { prs, truncated: after !== null };
}

const withSessions = (prs: PrSummary[], sessions: ReadonlyMap<string, string>) =>
  prs.map((pr) => { const sessionId = sessions.get(pr.url); return sessionId ? { ...pr, sessionId } : pr; });

export function ghError(e: unknown): string {
  const err = e as { code?: string; stderr?: string; message?: string };
  if (err.code === 'ENOENT') return 'gh não está instalado nesta máquina';
  const text = `${err.stderr ?? ''} ${err.message ?? ''}`;
  if (/auth login|not logged|authentication|HTTP 401/i.test(text)) return 'gh não está logado nesta máquina — rode `gh auth login`';
  const line = (err.stderr ?? err.message ?? 'falha ao falar com o GitHub').trim().split('\n').filter(Boolean).pop() ?? '';
  return line.slice(0, 300);
}

function sinceDate(days: number, now = Date.now()): string {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}

async function buildSnapshot(): Promise<PrsSnapshot> {
  const fetchedAt = Date.now();
  try {
    // The transcript grep (~5 s) runs alongside GitHub instead of before it.
    const [sessions, mine, merged, review] = await Promise.all([
      indexPrSessions(CONFIG.projectsDir),
      search('is:pr author:@me is:open archived:false sort:updated-desc', 'live', OPEN_PAGES),
      search(`is:pr author:@me is:merged merged:>=${sinceDate(MERGED_SINCE_DAYS, fetchedAt)} sort:updated-desc`, 'history', MERGED_PAGES),
      search('is:pr review-requested:@me is:open archived:false sort:updated-desc', 'live', 1),
    ]);
    const mergedPrs = withSessions(merged.prs, sessions).sort((a, b) => (b.mergedAt ?? '').localeCompare(a.mergedAt ?? ''));
    return {
      fetchedAt,
      mine: withSessions(mine.prs, sessions),
      merged: mergedPrs,
      review: withSessions(review.prs, sessions),
      mergedSinceDays: MERGED_SINCE_DAYS,
      mergedTruncated: merged.truncated,
    };
  } catch (e) {
    return { fetchedAt, mine: [], merged: [], review: [], mergedSinceDays: MERGED_SINCE_DAYS, mergedTruncated: false, error: ghError(e) };
  }
}

let cache: PrsSnapshot | null = null;
let inflight: Promise<PrsSnapshot> | null = null;
let diskLoaded = false;

const cachePath = () => process.env.COCKPIT_PRS_CACHE ?? join(homedir(), '.cockpit', 'prs-snapshot.json');

function loadDisk(): void {
  if (diskLoaded) return;
  diskLoaded = true;
  if (cache) return;
  try {
    const s = JSON.parse(readFileSync(cachePath(), 'utf8')) as PrsSnapshot;
    if (s && typeof s.fetchedAt === 'number' && Array.isArray(s.mine) && Array.isArray(s.merged) && Array.isArray(s.review)) cache = s;
  } catch { /* no cache yet, or an unreadable one: the first build rewrites it */ }
}

function saveDisk(s: PrsSnapshot): void {
  try {
    const path = cachePath();
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(s), { mode: 0o600 });
    renameSync(tmp, path);
  } catch { /* a cache that cannot be written only costs a cold start */ }
}

// GitHub's search index trails a merge by up to a minute, and a refresh may already
// have been in flight when it happened: either way the PR would pop back as open.
const JUST_MERGED_MS = 3 * 60_000;
const justMerged = new Map<string, { at: number; pr: PrSummary | null }>();

function withoutJustMerged(s: PrsSnapshot, now = Date.now()): PrsSnapshot {
  for (const [url, m] of justMerged) if (now - m.at > JUST_MERGED_MS) justMerged.delete(url);
  if (!justMerged.size) return s;
  const open = (p: PrSummary) => !justMerged.has(p.url);
  const missing = [...justMerged.values()].map((m) => m.pr).filter((p): p is PrSummary => !!p && !s.merged.some((x) => x.url === p.url));
  return { ...s, mine: s.mine.filter(open), review: s.review.filter(open), merged: [...missing, ...s.merged] };
}

function refresh(): Promise<PrsSnapshot> {
  if (inflight) return inflight;
  inflight = buildSnapshot().then((built) => {
    const s = built.error ? built : withoutJustMerged(built);
    // A failed refresh keeps the last good lists on screen, with the error on top.
    cache = s.error && cache && !cache.error ? { ...cache, error: s.error } : s;
    if (!s.error) saveDisk(s);
    return cache;
  }).finally(() => { inflight = null; });
  return inflight;
}

const isFresh = (s: PrsSnapshot | null, now: number) => !!s && !s.error && now - s.fetchedAt < SNAPSHOT_TTL_MS;

export async function getPrsSnapshot(force = false, now = Date.now()): Promise<PrsSnapshot> {
  loadDisk();
  if (!force && cache && isFresh(cache, now)) return cache;
  return refresh();
}

// Stale-while-revalidate: `cached` is whatever exists (memory or disk) at any age,
// `fresh` is set when it is missing, stale, failed, or the caller forced a refresh.
export function getPrsSnapshotSwr(force = false, now = Date.now()): { cached: PrsSnapshot | null; fresh: Promise<PrsSnapshot> | null } {
  loadDisk();
  const cached = cache;
  return { cached, fresh: force || !isFresh(cached, now) ? refresh() : null };
}

export function peekPrsSnapshot(): PrsSnapshot | null {
  loadDisk();
  return cache;
}

// Right after a merge the list should already show it: the real refresh takes ~20 s.
export function markPrMerged(url: string, now = Date.now()): PrsSnapshot | null {
  loadDisk();
  const found = cache ? [...cache.mine, ...cache.review].find((p) => p.url === url) : undefined;
  const asMerged = found ? { ...found, state: 'merged' as const, mergedAt: new Date(now).toISOString() } : null;
  justMerged.set(url, { at: now, pr: asMerged });
  if (!cache) return null;
  const merged = asMerged ? [asMerged, ...cache.merged.filter((p) => p.url !== url)] : cache.merged;
  cache = { ...cache, mine: cache.mine.filter((p) => p.url !== url), review: cache.review.filter((p) => p.url !== url), merged };
  return cache;
}

export async function getPrDetail(url: string): Promise<{ detail: PrDetail | null; error?: string }> {
  if (!PR_URL_RE.test(url)) return { detail: null, error: 'URL de PR inválida' };
  try {
    const sessions = peekPrSessions(CONFIG.projectsDir);
    const detail = detailFromResource(await graphql(DETAIL_QUERY, { url }), sessions);
    return detail ? { detail } : { detail: null, error: 'PR não encontrada' };
  } catch (e) {
    return { detail: null, error: ghError(e) };
  }
}

let login: string | null = null;
async function viewerLogin(): Promise<string> {
  if (!login) login = (await gh(['api', 'user', '--jq', '.login'])).trim();
  return login;
}

// The gate the client only mirrors: re-read the PR fresh, refuse someone else's PR
// (the owner reviews those, never merges them), a conflict, or a flagged PR without
// its typed confirmation.
export async function mergePr(url: string, confirm: string | undefined): Promise<{ ok: boolean; message?: string }> {
  const { detail, error } = await getPrDetail(url);
  if (!detail) return { ok: false, message: error ?? 'PR não encontrada' };
  try {
    if (detail.author.toLowerCase() !== (await viewerLogin()).toLowerCase()) return { ok: false, message: 'PR de outra pessoa — revise, não mergeie' };
  } catch (e) {
    return { ok: false, message: ghError(e) };
  }
  const blocker = mergeBlocker(detail);
  if (blocker) return { ok: false, message: blocker };
  if (needsMergeConfirm(detail) && confirm?.trim() !== mergeConfirmText(detail)) {
    return { ok: false, message: `PR marcada como ${detail.risk === 'unsafe' ? 'insegura' : 'arriscada'} — digite ${mergeConfirmText(detail)} pra confirmar` };
  }
  try {
    await gh(['pr', 'merge', url, '--squash', '--delete-branch']);
    markPrMerged(url);
    return { ok: true, message: `#${detail.number} mergeada` };
  } catch (e) {
    return { ok: false, message: ghError(e) };
  }
}
