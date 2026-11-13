import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { CONFIG } from '../config';
import { PR_URL_RE, type PrSummary, type SessionPrs } from '../../shared/prs';
import { sessionPath } from '../sessions/records';
import { indexPrSessions } from './pr-sessions';
import { graphql, ghError } from './prs';
import { LIST_FIELDS, prFromNode } from './prs-parse';

const run = promisify(execFile);

const MENTION_CAP = 40;
const CHUNK = 20;
const HYDRATE_TTL_MS = 60_000;
const PR_ANY_RE = 'https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+';

// Pure: the pr-link records (created) and every PR URL in file order (mentioned),
// the latter ordered by last appearance, most recent first.
export function urlListsFrom(prLinkLines: string, allUrls: string): { createdUrls: string[]; mentionedUrls: string[] } {
  const created: string[] = [];
  for (const line of prLinkLines.split('\n')) {
    if (!line.includes('"pr-link"')) continue;
    try {
      const o = JSON.parse(line) as { type?: unknown; prUrl?: unknown };
      if (o.type === 'pr-link' && typeof o.prUrl === 'string' && PR_URL_RE.test(o.prUrl) && !created.includes(o.prUrl)) created.push(o.prUrl);
    } catch { /* torn line */ }
  }
  const createdSet = new Set(created);
  const last = new Map<string, number>();
  allUrls.split('\n').forEach((u, i) => { if (PR_URL_RE.test(u) && !createdSet.has(u)) last.set(u, i); });
  const mentionedUrls = [...last].sort((a, b) => b[1] - a[1]).slice(0, MENTION_CAP).map(([u]) => u);
  return { createdUrls: created, mentionedUrls };
}

async function grep(args: string[]): Promise<string> {
  try {
    return (await run('grep', args, { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 })).stdout;
  } catch (e) {
    const err = e as { code?: number; stdout?: string };
    if (err.code === 1) return '';
    throw e;
  }
}

const lists = new Map<string, { key: string; value: { createdUrls: string[]; mentionedUrls: string[] } }>();
const hydrated = new Map<string, { at: number; key: string; prs: PrSummary[] }>();

async function readLists(sessionId: string, path: string): Promise<{ createdUrls: string[]; mentionedUrls: string[] }> {
  let st;
  try { st = await stat(path); } catch { return { createdUrls: [], mentionedUrls: [] }; }
  const key = `${st.mtimeMs}:${st.size}`;
  const hit = lists.get(sessionId);
  if (hit?.key === key) return hit.value;
  const [links, urls] = await Promise.all([
    grep(['-hF', '"type":"pr-link"', '--', path]),
    grep(['-hoE', PR_ANY_RE, '--', path]),
  ]);
  const value = urlListsFrom(links, urls);
  lists.set(sessionId, { key, value });
  return value;
}

async function hydrate(urls: string[]): Promise<PrSummary[]> {
  const sessions = await indexPrSessions(CONFIG.projectsDir);
  const byUrl = new Map<string, PrSummary>();
  for (let i = 0; i < urls.length; i += CHUNK) {
    const chunk = urls.slice(i, i + CHUNK);
    const decl = chunk.map((_, j) => `$u${j}: URI!`).join(', ');
    const body = chunk.map((_, j) => `p${j}: resource(url: $u${j}) { ... on PullRequest { ${LIST_FIELDS} files(first: 100) { totalCount nodes { path } } } }`).join('\n');
    const vars: Record<string, string> = {};
    chunk.forEach((u, j) => { vars[`u${j}`] = u; });
    const raw = (await graphql(`query(${decl}) {\n${body}\n}`, vars)) as { data?: Record<string, unknown> };
    chunk.forEach((u, j) => {
      const pr = prFromNode(raw.data?.[`p${j}`], sessions);
      if (pr) byUrl.set(u, pr);
    });
  }
  return urls.map((u) => byUrl.get(u)).filter((p): p is PrSummary => !!p);
}

export async function getSessionPrs(sessionId: string, wantPrs: boolean): Promise<SessionPrs> {
  const path = sessionPath(sessionId);
  if (!path) return { sessionId, createdUrls: [], mentionedUrls: [], error: 'sessão inválida' };
  const { createdUrls, mentionedUrls } = await readLists(sessionId, path);
  const out: SessionPrs = { sessionId, createdUrls, mentionedUrls };
  const urls = [...createdUrls, ...mentionedUrls];
  if (!wantPrs || !urls.length) return out;
  const key = urls.join('\n');
  const hit = hydrated.get(sessionId);
  if (hit && hit.key === key && Date.now() - hit.at < HYDRATE_TTL_MS) return { ...out, prs: hit.prs };
  try {
    const prs = await hydrate(urls);
    hydrated.set(sessionId, { at: Date.now(), key, prs });
    return { ...out, prs };
  } catch (e) {
    return { ...out, error: ghError(e) };
  }
}
