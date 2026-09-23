import { CARD_MARKER_RE } from '../../shared/canvas';

// Which memory files a session touched, read from its JSONL. Only the agent's own
// tool calls count: tool RESULTS are skipped on purpose, otherwise a `grep -rl`
// listing twenty memory files would wire the session to all twenty.

export type RefKind = 'read' | 'write';

// Loose context signal for topic matching (unlike `contexts`, which only fires on
// a memory-file tool call): repos/dirs touched, skills run, MCP servers called.
// Counted rather than boolean so the matcher can weigh a repo mentioned 40 times
// over one seen in a single stray path. Optional on SessionRefs so an older cache
// entry (written before this field existed) deserializes fine with it absent —
// the caller decides whether absence means "empty" or "needs a rescan".
export interface SessionTopics {
  dirs: Record<string, number>;
  skills: Record<string, number>;
  mcp: Record<string, number>;
}

export interface SessionRefs {
  contexts: Record<string, RefKind>;
  // How many tool calls touched each context, regardless of kind — a session
  // that wrote a memory file once and read it back thirty times cares about it
  // more than one that read it in passing. Optional and additive on purpose:
  // an entry loaded from an OLDER canvas-refs.json cache simply won't have it,
  // and every reader treats "absent" as "weight unknown, count it as 1" rather
  // than requiring a cache-schema bump.
  contextHits?: Record<string, number>;
  cardId?: string;
  topics?: SessionTopics;
  consumed: number; // bytes of complete lines already scanned (JSONL is append-only)
}

const MEM_RE = /\/memory\/([A-Za-z0-9_-]{1,80})\.md\b/g;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const PATH_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit']);

// Repo/dir tokens: the first path segment under the home dir, skipping the
// directories that are not a project (agent config, one-shot uploads, scratch).
const IGNORED_DIRS = new Set(['.claude', 'attachments', 'tmp']);
const HOME_RE = /^\/home\/[a-zA-Z0-9_-]+\//;
const FILE_PATH_RE = /"file_path":"((?:[^"\\]|\\.)*)"/g;
const CWD_RE = /"cwd":"((?:[^"\\]|\\.)*)"/g;
const CD_RE = /\bcd\s+(?:~\/|\/home\/[a-zA-Z0-9_-]+\/)([a-zA-Z0-9_.-]+)/g;
const SKILL_RE = /"skill":"([a-zA-Z0-9_-]+)"/g;
const MCP_RE = /"name":"mcp__([a-zA-Z0-9_-]+?)__/g;

export function emptyRefs(): SessionRefs {
  return { contexts: {}, topics: emptyTopics(), consumed: 0 };
}

export function emptyTopics(): SessionTopics {
  return { dirs: {}, skills: {}, mcp: {} };
}

function bump(rec: Record<string, number>, key: string | undefined) {
  if (!key) return;
  rec[key] = (rec[key] ?? 0) + 1;
}

// `/home/<user>/<dir>/...` -> `<dir>`, or undefined for a path outside the home
// dir or in one of the ignored dirs.
function dirToken(path: string): string | undefined {
  if (!HOME_RE.test(path)) return undefined;
  const seg = path.replace(HOME_RE, '').split('/')[0];
  return seg && !IGNORED_DIRS.has(seg) ? seg : undefined;
}

// Cheap regex pass over the raw line (no JSON.parse): file paths, cwd, `cd`
// inside Bash commands, skill names, MCP server names. Loose on purpose — this
// feeds a fuzzy weighted match, not the precise read/write edge below, so a
// path echoed back in a tool result still correctly says "this session touched
// that repo".
function scanTopicsLine(line: string, topics: SessionTopics): void {
  let m: RegExpExecArray | null;
  FILE_PATH_RE.lastIndex = 0;
  while ((m = FILE_PATH_RE.exec(line))) bump(topics.dirs, dirToken(m[1]));
  CWD_RE.lastIndex = 0;
  while ((m = CWD_RE.exec(line))) bump(topics.dirs, dirToken(m[1]));
  CD_RE.lastIndex = 0;
  while ((m = CD_RE.exec(line))) bump(topics.dirs, IGNORED_DIRS.has(m[1]) ? undefined : m[1]);
  SKILL_RE.lastIndex = 0;
  while ((m = SKILL_RE.exec(line))) bump(topics.skills, m[1]);
  MCP_RE.lastIndex = 0;
  while ((m = MCP_RE.exec(line))) bump(topics.mcp, m[1]);
}

function addRef(refs: SessionRefs, id: string, kind: RefKind) {
  if (id === 'MEMORY') return;
  bump(refs.contextHits ?? (refs.contextHits = {}), id);
  if (refs.contexts[id] === 'write') return;
  refs.contexts[id] = kind;
}

function memIds(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(MEM_RE)) out.push(m[1]);
  return out;
}

function firstUserText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  for (const b of content as { type?: string; text?: string }[]) if (b?.type === 'text' && typeof b.text === 'string') return b.text;
  return '';
}

export function scanRefsLine(line: string, refs: SessionRefs): void {
  scanTopicsLine(line, refs.topics ?? (refs.topics = emptyTopics()));
  const maybeTool = line.includes('"tool_use"') && line.includes('/memory/');
  const maybeCard = !refs.cardId && line.includes('[deck-card:');
  if (!maybeTool && !maybeCard) return;
  let rec: { type?: string; message?: { content?: unknown } };
  try { rec = JSON.parse(line); } catch { return; }
  const content = rec.message?.content;
  if (maybeCard && rec.type === 'user') {
    // LAST match, not first: server/canvas/flows.ts injects an untrusted
    // model result ahead of its own trailing marker when it builds a
    // follow-up prompt, and that result can itself contain an echoed
    // `[deck-card:...]` substring (quoted from an earlier turn). The first
    // match in the string can be that echo; the marker this turn actually
    // carries is always the last one.
    let m: RegExpMatchArray | undefined;
    for (const c of firstUserText(content).matchAll(new RegExp(CARD_MARKER_RE.source, 'g'))) m = c;
    if (m) refs.cardId = m[1];
  }
  if (!maybeTool || rec.type !== 'assistant' || !Array.isArray(content)) return;
  for (const b of content as { type?: string; name?: string; input?: Record<string, unknown> }[]) {
    if (b?.type !== 'tool_use' || !b.name || !b.input) continue;
    if (PATH_TOOLS.has(b.name) && typeof b.input.file_path === 'string') {
      for (const id of memIds(b.input.file_path)) addRef(refs, id, WRITE_TOOLS.has(b.name) ? 'write' : 'read');
    } else if (b.name === 'Bash' && typeof b.input.command === 'string') {
      for (const id of memIds(b.input.command)) addRef(refs, id, 'read');
    }
  }
}

// Feeds a chunk of raw bytes; only complete lines are consumed, and the returned
// count says how many bytes of `buf` that was so the caller can carry the rest.
export function scanRefsBuffer(buf: Buffer, refs: SessionRefs): number {
  const end = buf.lastIndexOf(0x0a);
  if (end < 0) return 0;
  const text = buf.subarray(0, end + 1).toString('utf8');
  for (const line of text.split('\n')) if (line) scanRefsLine(line, refs);
  refs.consumed += end + 1;
  return end + 1;
}
