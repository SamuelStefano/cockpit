import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Which Deck chat opened each PR: Claude Code writes a `pr-link` record into the
// session transcript when it creates one. A full grep over ~4 GB of transcripts
// takes ~5 s on the VPS, so the map is cached and rebuilt at most every few minutes.
const TTL_MS = 3 * 60_000;

let cached: { at: number; dir: string; map: Map<string, string> } | null = null;
let inflight: Promise<Map<string, string>> | null = null;

export function parsePrLinks(text: string): Map<string, string> {
  const first = new Map<string, { sessionId: string; ts: string }>();
  for (const line of text.split('\n')) {
    if (!line.includes('"pr-link"')) continue;
    let o: Record<string, unknown>;
    try { o = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
    if (o.type !== 'pr-link' || typeof o.prUrl !== 'string' || typeof o.sessionId !== 'string') continue;
    const ts = typeof o.timestamp === 'string' ? o.timestamp : '';
    const prev = first.get(o.prUrl);
    // The earliest record wins: that is the session that created the PR, not one
    // that merely resumed it later.
    if (!prev || (ts && ts < prev.ts)) first.set(o.prUrl, { sessionId: o.sessionId, ts });
  }
  return new Map([...first].map(([url, v]) => [url, v.sessionId]));
}

async function scan(dir: string): Promise<Map<string, string>> {
  try {
    const { stdout } = await run('grep', ['-rhF', '--include=*.jsonl', '"type":"pr-link"', dir], { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 });
    return parsePrLinks(stdout);
  } catch (e) {
    // grep exits 1 when nothing matches — an empty index, not a failure.
    const err = e as { code?: number; stdout?: string };
    return err.code === 1 ? new Map() : parsePrLinks(err.stdout ?? '');
  }
}

export async function indexPrSessions(dir: string, now = Date.now()): Promise<Map<string, string>> {
  if (cached && cached.dir === dir && now - cached.at < TTL_MS) return cached.map;
  if (inflight) return inflight;
  inflight = scan(dir).then((map) => { cached = { at: Date.now(), dir, map }; return map; }).finally(() => { inflight = null; });
  return inflight;
}

// For answers that must not wait ~5 s on a cold grep: whatever index exists now
// (possibly none), with a rebuild kicked off for the next caller.
export function peekPrSessions(dir: string): ReadonlyMap<string, string> {
  void indexPrSessions(dir).catch(() => undefined);
  return cached && cached.dir === dir ? cached.map : new Map();
}
