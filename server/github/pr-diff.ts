import { PR_URL_RE, type PrDiff } from '../../shared/prs';
import { filesFromPages } from './pr-diff-parse';
import { ghError, runGh } from './prs';

const PAGE = 100;
const MAX_PAGES = 3;
const TTL_MS = 60_000;
const MAX_ENTRIES = 20;

const cache = new Map<string, { at: number; diff: PrDiff }>();
const inflight = new Map<string, Promise<PrDiff>>();

export function clearPrDiffCache(): void { cache.clear(); inflight.clear(); }

async function fetchDiff(url: string): Promise<PrDiff> {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url);
  if (!m) throw new Error('URL de PR inválida');
  const [, owner, repo, n] = m;
  const pages: unknown[][] = [];
  let more = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = JSON.parse(await runGh(['api', `repos/${owner}/${repo}/pulls/${n}/files?per_page=${PAGE}&page=${page}`])) as unknown[];
    if (!Array.isArray(rows)) break;
    pages.push(rows);
    more = rows.length === PAGE;
    if (!more) break;
  }
  const { files, truncated } = filesFromPages(pages);
  return { url, files, totalFiles: files.length, truncated: truncated || more };
}

export async function getPrDiff(url: string, now = Date.now()): Promise<{ diff: PrDiff | null; error?: string }> {
  if (!PR_URL_RE.test(url)) return { diff: null, error: 'URL de PR inválida' };
  const hit = cache.get(url);
  if (hit && now - hit.at < TTL_MS) return { diff: hit.diff };
  let p = inflight.get(url);
  if (!p) {
    p = fetchDiff(url).then((diff) => {
      cache.delete(url);
      cache.set(url, { at: Date.now(), diff });
      while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
      return diff;
    }).finally(() => { inflight.delete(url); });
    inflight.set(url, p);
  }
  try {
    return { diff: await p };
  } catch (e) {
    return { diff: null, error: ghError(e) };
  }
}
