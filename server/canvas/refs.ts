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

// Per-file write timestamps (ms epoch), absolute path -> last write. Feeds the
// conflict-edge builder (two sessions writing the same file close in time).
// Capped to the most recently written files so a long-lived session's cache
// entry stays bounded.
export type FileWrites = Record<string, number>;

// Merged activity intervals (ms epoch, [start, end], ascending, newest last).
// Records within ACTIVITY_MERGE_MS of the previous interval's end extend it
// instead of opening a new one. Feeds the timeline's aliveAt().
export type ActivityIntervals = [number, number][];

// A write tool_use is recorded provisionally (keyed by its tool_use id) and
// only promoted into `writes` once its tool_result comes back WITHOUT
// is_error — a denied or failed Edit never touched the file and must not
// read as a conflict candidate. Capped defensively; in practice a result
// follows its tool_use within one or two lines, so this never grows large.
export interface PendingWrite { path: string; at: number }

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
  writes?: FileWrites;
  activity?: ActivityIntervals;
  pendingWrites?: Record<string, PendingWrite>;
  consumed: number; // bytes of complete lines already scanned (JSONL is append-only)
}

const MEM_RE = /\/memory\/([A-Za-z0-9_-]{1,80})\.md\b/g;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const PATH_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit']);
// Tools that write an actual file on disk (as opposed to a memory-context
// write, tracked separately above): candidates for the conflict-edge graph.
const FILE_WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const WRITE_TOOL_NAME_RE = /"name":"(?:Edit|Write|MultiEdit|NotebookEdit)"/;
const TIMESTAMP_RE = /"timestamp":"([^"]+)"/;
const MAX_TRACKED_WRITES = 300;
const MAX_ACTIVITY_INTERVALS = 200;
const MAX_PENDING_WRITES = 50;
const ACTIVITY_MERGE_MS = 15 * 60_000;

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
  return { contexts: {}, topics: emptyTopics(), writes: {}, activity: [], consumed: 0 };
}

// Records (or bumps) a write, then evicts the oldest entries once over the
// cap — a full sort only runs on the rare session that actually crosses it.
export function addWrite(writes: FileWrites, path: string, at: number): void {
  writes[path] = Math.max(writes[path] ?? 0, at);
  const keys = Object.keys(writes);
  if (keys.length <= MAX_TRACKED_WRITES) return;
  keys.sort((a, b) => writes[a] - writes[b]);
  for (const k of keys.slice(0, keys.length - MAX_TRACKED_WRITES)) delete writes[k];
}

// Extends the last interval if `at` falls within the merge window of its end,
// otherwise opens a new one. Assumes records arrive in roughly chronological
// order (true within one scan pass; a rescan starts from an empty array).
export function addActivity(activity: ActivityIntervals, at: number): void {
  const last = activity[activity.length - 1];
  if (last && at >= last[0] && at - last[1] <= ACTIVITY_MERGE_MS) {
    if (at > last[1]) last[1] = at;
    return;
  }
  if (last && at < last[1]) return; // stray out-of-order timestamp; not worth a new interval
  activity.push([at, at]);
  if (activity.length > MAX_ACTIVITY_INTERVALS) activity.shift();
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

// Parks a write behind its tool_use id instead of committing it right away —
// resolved by resolvePendingWrite once the matching tool_result is seen.
function parkWrite(refs: SessionRefs, toolUseId: string, path: string, at: number): void {
  const pending = refs.pendingWrites ?? (refs.pendingWrites = {});
  pending[toolUseId] = { path, at };
  const keys = Object.keys(pending);
  if (keys.length > MAX_PENDING_WRITES) delete pending[keys[0]]; // oldest first: object key order is insertion order here
}

// A 'user' message carries tool_result blocks (id -> is_error). Commits the
// matching pending write into `writes` unless the tool reported an error —
// a denied or failed Edit never touched the file.
function resolveToolResults(refs: SessionRefs, content: unknown): void {
  const pending = refs.pendingWrites;
  if (!pending || !Array.isArray(content)) return;
  for (const b of content as { type?: string; tool_use_id?: string; is_error?: boolean }[]) {
    if (b?.type !== 'tool_result' || typeof b.tool_use_id !== 'string') continue;
    const p = pending[b.tool_use_id];
    if (!p) continue;
    delete pending[b.tool_use_id];
    if (!b.is_error) addWrite(refs.writes ?? (refs.writes = {}), p.path, p.at);
  }
}

export function scanRefsLine(line: string, refs: SessionRefs): void {
  scanTopicsLine(line, refs.topics ?? (refs.topics = emptyTopics()));
  const tsMatch = TIMESTAMP_RE.exec(line);
  const at = tsMatch ? Date.parse(tsMatch[1]) : NaN;
  if (!Number.isNaN(at)) addActivity(refs.activity ?? (refs.activity = []), at);
  const maybeMemTool = line.includes('"tool_use"') && line.includes('/memory/');
  // Narrower than "any tool_use line": Read/Bash/Grep/… on a session with
  // thousands of tool calls would otherwise JSON.parse every single one just
  // to find the rare Edit/Write. Only a write-tool name (or a memory path,
  // handled above) earns the parse.
  const maybeWriteTool = line.includes('"tool_use"') && WRITE_TOOL_NAME_RE.test(line);
  const maybeCard = !refs.cardId && line.includes('[deck-card:');
  const maybeResult = !!refs.pendingWrites && Object.keys(refs.pendingWrites).length > 0 && line.includes('"tool_result"');
  if (!maybeMemTool && !maybeWriteTool && !maybeCard && !maybeResult) return;
  let rec: { type?: string; timestamp?: string; message?: { content?: unknown } };
  try { rec = JSON.parse(line); } catch { return; }
  const content = rec.message?.content;
  if (rec.type === 'user') {
    if (maybeCard) {
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
    if (maybeResult) resolveToolResults(refs, content);
    return;
  }
  if (!(maybeMemTool || maybeWriteTool) || rec.type !== 'assistant' || !Array.isArray(content)) return;
  // The parsed record's own timestamp is authoritative once we're already
  // parsing the line — no need for a second regex pass on top of `at`.
  const writeAt = rec.timestamp ? Date.parse(rec.timestamp) : at;
  for (const b of content as { type?: string; id?: string; name?: string; input?: Record<string, unknown> }[]) {
    if (b?.type !== 'tool_use' || !b.name || !b.input) continue;
    if (PATH_TOOLS.has(b.name) && typeof b.input.file_path === 'string') {
      for (const id of memIds(b.input.file_path)) addRef(refs, id, WRITE_TOOLS.has(b.name) ? 'write' : 'read');
    } else if (b.name === 'Bash' && typeof b.input.command === 'string') {
      for (const id of memIds(b.input.command)) addRef(refs, id, 'read');
    }
    if (FILE_WRITE_TOOLS.has(b.name) && b.id && !Number.isNaN(writeAt)) {
      const path = typeof b.input.file_path === 'string' ? b.input.file_path
        : typeof b.input.notebook_path === 'string' ? b.input.notebook_path : undefined;
      if (path) parkWrite(refs, b.id, path, writeAt);
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
