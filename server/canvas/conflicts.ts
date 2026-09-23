import { sessionNodeId, type CanvasEdge } from '../../shared/canvas';

// Two sessions editing the SAME file outside the memory dir are a merge
// conflict waiting to happen. Absolute-path equality is deliberately the
// whole rule: two git worktrees of the same repo never share an absolute
// path (each checkout lives in its own directory), so plain equality is
// already worktree-safe — no relative-path normalization needed, and none
// wanted (it would wrongly flag two isolated checkouts as one file).
export const MAX_CONFLICT_FILES = 5;
// Two writes past this far apart never count, no matter how "alive" either
// session was — this is a ceiling, not the main test (see isConflictingPair).
export const CONFLICT_NEAR_WRITE_MS = 2 * 3600_000;

const NOISY_SEGMENTS = ['/node_modules/', '/.git/', '/dist/'];
const LOCKFILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock',
  'Cargo.lock', 'composer.lock', 'poetry.lock', 'Gemfile.lock',
]);

export interface NoisyPathConfig {
  memoryDir: string; // absolute, e.g. CONFIG.memoryDir — prefix match only
  tmpDir: string; // absolute, e.g. os.tmpdir() — prefix match only
}

function hasPrefix(path: string, dir: string): boolean {
  if (!dir) return false;
  return path === dir || path.startsWith(dir.endsWith('/') ? dir : `${dir}/`);
}

// memoryDir/tmpDir are matched by PREFIX (they name one specific absolute
// directory) — a substring match would also hide an unrelated repo's own
// `src/memory/` or a project's own `tmp/` subfolder. node_modules/.git/dist
// stay substring-on-segment: those are conventionally noise at any depth.
export function isNoisyPath(path: string, cfg: NoisyPathConfig): boolean {
  if (hasPrefix(path, cfg.memoryDir) || hasPrefix(path, cfg.tmpDir)) return true;
  if (NOISY_SEGMENTS.some((seg) => path.includes(seg))) return true;
  const base = path.split('/').pop() ?? '';
  return LOCKFILES.has(base);
}

export interface SessionWrites {
  id: string; // session uuid
  writes: Record<string, number>; // absolute path -> last write ms
  activity: [number, number][]; // merged activity intervals, feeds the overlap/liveness check
}

export interface ConflictInput {
  sessions: SessionWrites[];
  active: Set<string>; // session ids considered active (running/waiting/recent)
  noisy: NoisyPathConfig;
  now?: number;
}

function intervalsOverlap(a: [number, number][], b: [number, number][]): boolean {
  for (const [as, ae] of a) for (const [bs, be] of b) if (as <= be && bs <= ae) return true;
  return false;
}

function aliveAt(activity: [number, number][], t: number): boolean {
  return activity.some(([s, e]) => t >= s && t <= e);
}

// Same file, but is it really a LIVE collision? Two writes decades apart on
// an always-touched config file are not. Either:
//  - the two sessions' activity windows actually overlap (concurrent work), or
//  - the writes are close (<=2h) AND each session was still alive around the
//    OTHER's write instant — not just its own, which is true by definition
//    and would make this check vacuous.
function isConflictingPair(wa: { at: number }, wb: { at: number }, activityA: [number, number][], activityB: [number, number][]): boolean {
  if (intervalsOverlap(activityA, activityB)) return true;
  if (Math.abs(wa.at - wb.at) > CONFLICT_NEAR_WRITE_MS) return false;
  return aliveAt(activityA, wb.at) && aliveAt(activityB, wa.at);
}

// Builds one 'conflict' edge per pair of sessions that wrote the same
// (non-noisy) path while genuinely concurrent (see isConflictingPair), with
// at least one of the two active. Multiple shared files between the same
// pair collapse into a single edge carrying up to MAX_CONFLICT_FILES paths
// (most recent first).
export function buildConflictEdges(input: ConflictInput): CanvasEdge[] {
  const activityById = new Map(input.sessions.map((s) => [s.id, s.activity]));
  const byPath = new Map<string, { id: string; at: number }[]>();
  for (const s of input.sessions) {
    for (const [path, at] of Object.entries(s.writes)) {
      if (isNoisyPath(path, input.noisy)) continue;
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
        if (!input.active.has(wa.id) && !input.active.has(wb.id)) continue;
        if (!isConflictingPair(wa, wb, activityById.get(wa.id) ?? [], activityById.get(wb.id) ?? [])) continue;
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
