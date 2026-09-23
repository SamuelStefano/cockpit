import { describe, it, expect } from 'vitest';
import { buildConflictEdges, isNoisyPath, CONFLICT_NEAR_WRITE_MS, type NoisyPathConfig } from './conflicts';

const NOISY: NoisyPathConfig = { memoryDir: '/home/u/.claude/projects/x/memory', tmpDir: '/tmp' };

describe('isNoisyPath', () => {
  it('excludes the memory dir and the OS tmp dir by PREFIX', () => {
    expect(isNoisyPath('/home/u/.claude/projects/x/memory/hub_deck.md', NOISY)).toBe(true);
    expect(isNoisyPath('/tmp/scratch/a.ts', NOISY)).toBe(true);
  });

  it('does NOT exclude a repo dir that merely CONTAINS "memory" or "tmp" as a substring', () => {
    // A prefix match, not a substring match: a project's own src/memory/ or
    // .../tmp/... segment must stay visible to conflict detection.
    expect(isNoisyPath('/home/u/repo/src/memory/store.ts', NOISY)).toBe(false);
    expect(isNoisyPath('/home/u/repo/tmp/cache.json', NOISY)).toBe(false);
    expect(isNoisyPath('/home/u/repo/src/attempt.ts', NOISY)).toBe(false);
  });

  it('still excludes node_modules, .git, dist by segment anywhere in the path', () => {
    expect(isNoisyPath('/home/u/repo/node_modules/pkg/index.js', NOISY)).toBe(true);
    expect(isNoisyPath('/home/u/repo/.git/HEAD', NOISY)).toBe(true);
    expect(isNoisyPath('/home/u/repo/dist/bundle.js', NOISY)).toBe(true);
  });

  it('ignores lockfiles by basename', () => {
    expect(isNoisyPath('/home/u/repo/package-lock.json', NOISY)).toBe(true);
    expect(isNoisyPath('/home/u/repo/pnpm-lock.yaml', NOISY)).toBe(true);
  });

  it('keeps a normal source file', () => {
    expect(isNoisyPath('/home/u/repo/src/App.tsx', NOISY)).toBe(false);
  });

  it('never matches when memoryDir/tmpDir are empty (safe default, not "match everything")', () => {
    expect(isNoisyPath('/any/absolute/path.ts', { memoryDir: '', tmpDir: '' })).toBe(false);
  });
});

describe('buildConflictEdges', () => {
  const path = '/home/u/repo/src/App.tsx';

  it('flags two sessions both continuously alive across the span between their close writes, one active', () => {
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [path]: 1_000 }, activity: [[0, 2_000]] },
        { id: 's2', writes: { [path]: 1_500 }, activity: [[1_000, 3_000]] },
      ],
      active: new Set(['s1']),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: 's:s1', target: 's:s2', kind: 'conflict', files: [path] });
  });

  it('flags two sessions with SEQUENTIAL (non-overlapping) activity when writes are close and each was alive at the OTHER write instant', () => {
    const wa = 1_000_000;
    const wb = wa + 30 * 60_000; // 30min later, well inside the 2h near-window
    const edges = buildConflictEdges({
      sessions: [
        // s1 alive from wa-10min to wb+10min (covers wb): bridges the gap
        { id: 's1', writes: { [path]: wa }, activity: [[wa - 600_000, wb + 600_000]] },
        { id: 's2', writes: { [path]: wb }, activity: [[wa - 600_000, wb + 600_000]] },
      ],
      active: new Set(['s2']),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(1);
  });

  it('does NOT flag two isolated sequential writes: close in time but neither alive at the other\'s instant', () => {
    const wa = 1_000_000;
    const wb = wa + 30 * 60_000;
    const edges = buildConflictEdges({
      sessions: [
        // Each session's own activity interval covers only ITS OWN write — a
        // single drive-by edit, not sustained overlapping work.
        { id: 's1', writes: { [path]: wa }, activity: [[wa - 60_000, wa + 60_000]] },
        { id: 's2', writes: { [path]: wb }, activity: [[wb - 60_000, wb + 60_000]] },
      ],
      active: new Set(['s1', 's2']),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(0);
  });

  it('does not flag writes further apart than the 2h near-window with no activity overlap', () => {
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [path]: 0 }, activity: [[0, 0]] },
        { id: 's2', writes: { [path]: CONFLICT_NEAR_WRITE_MS + 1 }, activity: [[CONFLICT_NEAR_WRITE_MS + 1, CONFLICT_NEAR_WRITE_MS + 1]] },
      ],
      active: new Set(['s1', 's2']),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(0);
  });

  it('does NOT flag two writes 59h apart just because the sessions overlapped 3 days ago on unrelated work', () => {
    const DAY = 24 * 3600_000;
    const HOUR = 3600_000;
    const wa = 3 * DAY;
    const wb = wa + 59 * HOUR; // > CONFLICT_NEAR_WRITE_MS (2h), must reject regardless of any overlap
    const edges = buildConflictEdges({
      sessions: [
        // [0,1000] and [500,1500] overlap each other — but nowhere near either write.
        { id: 's1', writes: { [path]: wa }, activity: [[0, 1000], [wa - 100, wa + 100]] },
        { id: 's2', writes: { [path]: wb }, activity: [[500, 1500], [wb - 100, wb + 100]] },
      ],
      active: new Set(['s1', 's2']),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(0);
  });

  it('does not flag when neither session is active', () => {
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [path]: 1000 }, activity: [[0, 2000]] },
        { id: 's2', writes: { [path]: 1500 }, activity: [[1000, 3000]] },
      ],
      active: new Set(),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(0);
  });

  it('ignores a noisy path even with fully overlapping activity', () => {
    const noisy = '/home/u/repo/node_modules/pkg/index.js';
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [noisy]: 0 }, activity: [[0, 2000]] },
        { id: 's2', writes: { [noisy]: 1000 }, activity: [[0, 2000]] },
      ],
      active: new Set(['s1', 's2']),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(0);
  });

  it('does not flag the same absolute path a session wrote to itself', () => {
    const edges = buildConflictEdges({ sessions: [{ id: 's1', writes: { [path]: 0 }, activity: [[0, 0]] }], active: new Set(['s1']), noisy: NOISY });
    expect(edges).toHaveLength(0);
  });

  it('treats different worktree checkouts of the same repo as different files (no conflict)', () => {
    // Same relative path, different absolute checkout roots: NOT a conflict.
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { '/home/u/cockpit/src/App.tsx': 0 }, activity: [[0, 2000]] },
        { id: 's2', writes: { '/home/u/cockpit-wt/other/src/App.tsx': 1000 }, activity: [[0, 2000]] },
      ],
      active: new Set(['s1', 's2']),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(0);
  });

  it('flags the same absolute path within the same checkout even under a worktree dir', () => {
    const p = '/home/u/cockpit-wt/tempo/src/App.tsx';
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [p]: 0 }, activity: [[0, 2000]] },
        { id: 's2', writes: { [p]: 1000 }, activity: [[0, 2000]] },
      ],
      active: new Set(['s1', 's2']),
      noisy: NOISY,
    });
    expect(edges).toHaveLength(1);
  });

  it('collapses multiple shared files between the same pair into one edge, newest first, capped at 5', () => {
    const sessions = [
      { id: 's1', writes: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`/r/f${i}.ts`, i])), activity: [[0, 20]] as [number, number][] },
      { id: 's2', writes: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`/r/f${i}.ts`, i + 10])), activity: [[0, 20]] as [number, number][] },
    ];
    const edges = buildConflictEdges({ sessions, active: new Set(['s1']), noisy: NOISY });
    expect(edges).toHaveLength(1);
    expect(edges[0].files).toHaveLength(5);
    expect(edges[0].files).toEqual(['/r/f6.ts', '/r/f5.ts', '/r/f4.ts', '/r/f3.ts', '/r/f2.ts']);
  });
});
