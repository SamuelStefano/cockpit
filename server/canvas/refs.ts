import { CARD_MARKER_RE } from '../../shared/canvas';

// Which memory files a session touched, read from its JSONL. Only the agent's own
// tool calls count: tool RESULTS are skipped on purpose, otherwise a `grep -rl`
// listing twenty memory files would wire the session to all twenty.

export type RefKind = 'read' | 'write';

export interface SessionRefs {
  contexts: Record<string, RefKind>;
  cardId?: string;
  consumed: number; // bytes of complete lines already scanned (JSONL is append-only)
}

const MEM_RE = /\/memory\/([A-Za-z0-9_-]{1,80})\.md\b/g;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const PATH_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit']);

export function emptyRefs(): SessionRefs {
  return { contexts: {}, consumed: 0 };
}

function addRef(refs: SessionRefs, id: string, kind: RefKind) {
  if (id === 'MEMORY') return;
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
  const maybeTool = line.includes('"tool_use"') && line.includes('/memory/');
  const maybeCard = !refs.cardId && line.includes('[deck-card:');
  if (!maybeTool && !maybeCard) return;
  let rec: { type?: string; message?: { content?: unknown } };
  try { rec = JSON.parse(line); } catch { return; }
  const content = rec.message?.content;
  if (maybeCard && rec.type === 'user') {
    const m = CARD_MARKER_RE.exec(firstUserText(content));
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
