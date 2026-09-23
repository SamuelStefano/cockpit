import { sessionNodeId, type CanvasEdge } from '../../shared/canvas';

// Two sessions editing the SAME file outside the memory dir are a merge
// conflict waiting to happen. Absolute-path equality is deliberately the
// whole rule: two git worktrees of the same repo never share an absolute
// path (each checkout lives in its own directory), so plain equality is
// already worktree-safe — no relative-path normalization needed, and none
// wanted (it would wrongly flag two isolated checkouts as one file).
export const CONFLICT_WINDOW_MS = 48 * 3600_000;
export const MAX_CONFLICT_FILES = 5;

const NOISY_SEGMENTS = ['/tmp/', '/node_modules/', '/.git/', '/dist/', '/memory/'];
const LOCKFILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock',
  'Cargo.lock', 'composer.lock', 'poetry.lock', 'Gemfile.lock',
]);

export function isNoisyPath(path: string): boolean {
  if (NOISY_SEGMENTS.some((seg) => path.includes(seg))) return true;
  const base = path.split('/').pop() ?? '';
  return LOCKFILES.has(base);
}

export interface SessionWrites {
  id: string; // session uuid
  writes: Record<string, number>; // absolute path -> last write ms
}

export interface ConflictInput {
  sessions: SessionWrites[];
  active: Set<string>; // session ids considered active (running/waiting/recent)
  now?: number;
}

// Builds one 'conflict' edge per pair of sessions that wrote the same
// (non-noisy) path within CONFLICT_WINDOW_MS of each other, with at least one
// of the two active. Multiple shared files between the same pair collapse
// into a single edge carrying up to MAX_CONFLICT_FILES paths (most recent
// first).
export function buildConflictEdges(input: ConflictInput): CanvasEdge[] {
  const byPath = new Map<string, { id: string; at: number }[]>();
  for (const s of input.sessions) {
    for (const [path, at] of Object.entries(s.writes)) {
      if (isNoisyPath(path)) continue;
      const arr = byPath.get(path);
      if (arr) arr.push({ id: s.id, at }); else byPath.set(path, [{ id: s.id, at }]);
    }
  }

  const pairs = new Map<string, { a: string; b: string; files: Map<string, number> }>();
  for (const [path, writers] of byPath) {
    for (let i = 0; i < writers.length; i++) {
      for (let j = i + 1; j < writers.length; j++) {
        const wa = writers[i]; const wb = writers[j];
        if (wa.id === wb.id) continue;
        if (Math.abs(wa.at - wb.at) > CONFLICT_WINDOW_MS) continue;
        if (!input.active.has(wa.id) && !input.active.has(wb.id)) continue;
        const [a, b] = [wa.id, wb.id].sort();
        const key = `${a}\u0000${b}`;
        const entry = pairs.get(key) ?? { a, b, files: new Map() };
        entry.files.set(path, Math.max(entry.files.get(path) ?? 0, wa.at, wb.at));
        pairs.set(key, entry);
      }
    }
  }

  const edges: CanvasEdge[] = [];
  for (const { a, b, files } of pairs.values()) {
    const sorted = [...files.entries()].sort((x, y) => y[1] - x[1]).map(([p]) => p);
    edges.push({ source: sessionNodeId(a), target: sessionNodeId(b), kind: 'conflict', files: sorted.slice(0, MAX_CONFLICT_FILES) });
  }
  return edges;
}
