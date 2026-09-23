import { describe, it, expect } from 'vitest';
import { buildConflictEdges, isNoisyPath, CONFLICT_WINDOW_MS } from './conflicts';

describe('isNoisyPath', () => {
  it('ignores tmp, node_modules, .git, dist and the memory dir', () => {
    expect(isNoisyPath('/tmp/x/a.ts')).toBe(true);
    expect(isNoisyPath('/home/u/repo/node_modules/pkg/index.js')).toBe(true);
    expect(isNoisyPath('/home/u/repo/.git/HEAD')).toBe(true);
    expect(isNoisyPath('/home/u/repo/dist/bundle.js')).toBe(true);
    expect(isNoisyPath('/home/u/.claude/projects/x/memory/hub_deck.md')).toBe(true);
  });

  it('ignores lockfiles by basename', () => {
    expect(isNoisyPath('/home/u/repo/package-lock.json')).toBe(true);
    expect(isNoisyPath('/home/u/repo/pnpm-lock.yaml')).toBe(true);
  });

  it('keeps a normal source file', () => {
    expect(isNoisyPath('/home/u/repo/src/App.tsx')).toBe(false);
  });
});

describe('buildConflictEdges', () => {
  const path = '/home/u/repo/src/App.tsx';

  it('flags two sessions that wrote the same file within the window, one active', () => {
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [path]: 1000 } },
        { id: 's2', writes: { [path]: 1000 + 60_000 } },
      ],
      active: new Set(['s1']),
    });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: 's:s1', target: 's:s2', kind: 'conflict', files: [path] });
  });

  it('does not flag when neither session is active', () => {
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [path]: 1000 } },
        { id: 's2', writes: { [path]: 1000 + 60_000 } },
      ],
      active: new Set(),
    });
    expect(edges).toHaveLength(0);
  });

  it('does not flag writes further apart than the 48h window', () => {
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [path]: 0 } },
        { id: 's2', writes: { [path]: CONFLICT_WINDOW_MS + 1 } },
      ],
      active: new Set(['s1', 's2']),
    });
    expect(edges).toHaveLength(0);
  });

  it('ignores a noisy path even inside the window', () => {
    const noisy = '/home/u/repo/node_modules/pkg/index.js';
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [noisy]: 0 } },
        { id: 's2', writes: { [noisy]: 1000 } },
      ],
      active: new Set(['s1', 's2']),
    });
    expect(edges).toHaveLength(0);
  });

  it('does not flag the same absolute path a session wrote to itself', () => {
    const edges = buildConflictEdges({ sessions: [{ id: 's1', writes: { [path]: 0 } }], active: new Set(['s1']) });
    expect(edges).toHaveLength(0);
  });

  it('treats different worktree checkouts of the same repo as different files (no conflict)', () => {
    // Same relative path, different absolute checkout roots: NOT a conflict.
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { '/home/u/cockpit/src/App.tsx': 0 } },
        { id: 's2', writes: { '/home/u/cockpit-wt/other/src/App.tsx': 1000 } },
      ],
      active: new Set(['s1', 's2']),
    });
    expect(edges).toHaveLength(0);
  });

  it('flags the same absolute path within the same checkout even under a worktree dir', () => {
    const p = '/home/u/cockpit-wt/tempo/src/App.tsx';
    const edges = buildConflictEdges({
      sessions: [
        { id: 's1', writes: { [p]: 0 } },
        { id: 's2', writes: { [p]: 1000 } },
      ],
      active: new Set(['s1', 's2']),
    });
    expect(edges).toHaveLength(1);
  });

  it('collapses multiple shared files between the same pair into one edge, newest first, capped at 5', () => {
    const sessions = [
      { id: 's1', writes: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`/r/f${i}.ts`, i])) },
      { id: 's2', writes: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`/r/f${i}.ts`, i + 10])) },
    ];
    const edges = buildConflictEdges({ sessions, active: new Set(['s1']) });
    expect(edges).toHaveLength(1);
    expect(edges[0].files).toHaveLength(5);
    expect(edges[0].files).toEqual(['/r/f6.ts', '/r/f5.ts', '/r/f4.ts', '/r/f3.ts', '/r/f2.ts']);
  });
});
