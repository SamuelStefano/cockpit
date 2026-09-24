import { describe, expect, it } from 'vitest';
import type { CanvasFlow, CanvasNode, OrchestratorInfo } from '../../../shared/canvas';
import {
  buildChainTree, CHAIN_AREA_GAP, CHAIN_AREA_H, CHAIN_AREA_W, CHAIN_ROOT_H, CHAIN_ROOT_W, CHAIN_SESSION_GAP, CHAIN_SESSION_H,
  countRunning, estimateAreaHeight, hasLiveSession, layoutChainTree, sortSessions,
} from './chain-layout';

const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';
const S3 = '33333333-3333-3333-3333-333333333333';

function session(ref: string, extra: Partial<CanvasNode> = {}): CanvasNode {
  return { id: `s:${ref}`, kind: 'session', ref, title: ref.slice(0, 4), subtitle: '', mtime: 1, area: 'deck', ...extra };
}

describe('sortSessions', () => {
  it('sorts running first, then waiting, then most-recently-touched', () => {
    const a = session(S1, { mtime: 10 });
    const b = session(S2, { mtime: 30, waiting: true });
    const c = session(S3, { mtime: 20 });
    const out = sortSessions([c, a, b], new Set([S1]));
    expect(out.map((n) => n.ref)).toEqual([S1, S2, S3]); // running > waiting > idle(by mtime desc, but only one idle here)
  });

  it('breaks a same-tier tie by most recent mtime', () => {
    const a = session(S1, { mtime: 10 });
    const b = session(S2, { mtime: 20 });
    expect(sortSessions([a, b], new Set()).map((n) => n.ref)).toEqual([S2, S1]);
  });
});

describe('buildChainTree', () => {
  it('hangs a root session with no known parent under its area', () => {
    const nodes = [session(S1, { area: 'dfl' })];
    const tree = buildChainTree(nodes, [], new Set());
    expect(tree.kind).toBe('orchestrator');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].id).toBe('area:dfl');
    expect(tree.children[0].children.map((c) => c.node?.ref)).toEqual([S1]);
  });

  it('nests a fork child under its fork parent instead of the area', () => {
    const parent = session(S1, { area: 'dfl' });
    const child = session(S2, { area: 'dfl', parentSessionId: S1 });
    const tree = buildChainTree([parent, child], [], new Set());
    const area = tree.children.find((c) => c.id === 'area:dfl')!;
    expect(area.children.map((c) => c.node?.ref)).toEqual([S1]);
    expect(area.children[0].children.map((c) => c.node?.ref)).toEqual([S2]);
  });

  it('nests a flow successor under its source once the flow has actually fired', () => {
    const from = session(S1, { area: 'dfl' });
    const to = session(S2, { area: 'dfl' });
    const flow: CanvasFlow = { id: 'f1', from: `s:${S1}`, to: `s:${S2}`, template: '', enabled: true, createdAt: 1, fires: 1 };
    const tree = buildChainTree([from, to], [flow], new Set());
    const area = tree.children[0];
    expect(area.children.map((c) => c.node?.ref)).toEqual([S1]);
    expect(area.children[0].children.map((c) => c.node?.ref)).toEqual([S2]);
  });

  it('ignores a flow that has never fired', () => {
    const from = session(S1, { area: 'dfl' });
    const to = session(S2, { area: 'dfl' });
    const flow: CanvasFlow = { id: 'f1', from: `s:${S1}`, to: `s:${S2}`, template: '', enabled: true, createdAt: 1, fires: 0 };
    const tree = buildChainTree([from, to], [flow], new Set());
    const area = tree.children[0];
    expect(area.children.map((c) => c.node?.ref).sort()).toEqual([S1, S2].sort());
  });

  it('prefers a fork parent over a fired flow when both point somewhere', () => {
    const s1 = session(S1, { area: 'dfl' });
    const s2 = session(S2, { area: 'dfl' });
    const s3 = session(S3, { area: 'dfl', parentSessionId: S1 }); // real parent: S1
    const flow: CanvasFlow = { id: 'f1', from: `s:${S2}`, to: `s:${S3}`, template: '', enabled: true, createdAt: 1, fires: 3 };
    const tree = buildChainTree([s1, s2, s3], [flow], new Set());
    const area = tree.children[0];
    const s1Item = area.children.find((c) => c.node?.ref === S1)!;
    expect(s1Item.children.map((c) => c.node?.ref)).toEqual([S3]);
  });

  it('breaks a cyclic fork-parent pointer instead of looping forever, keeping every session exactly once', () => {
    // S1 claims S2 as parent and S2 claims S1 as parent — impossible in
    // practice, but the guard must not hang or crash on corrupt data. The
    // first offending edge in iteration order is dropped, which breaks the
    // cycle; the other edge (now acyclic) is free to stand.
    const s1 = session(S1, { area: 'dfl', parentSessionId: S2 });
    const s2 = session(S2, { area: 'dfl', parentSessionId: S1 });
    const tree = buildChainTree([s1, s2], [], new Set());
    function flatten(item: (typeof tree)): string[] {
      return [...(item.node ? [item.node.ref] : []), ...item.children.flatMap(flatten)];
    }
    expect(flatten(tree).sort()).toEqual([S1, S2].sort());
    expect(tree.children[0].children).toHaveLength(1); // exactly one area root, not two
  });

  it('puts the orchestrator\'s own session at the root, not under its area', () => {
    const orchInfo: OrchestratorInfo = { name: 'Orch', sessionId: S1, tmux: 'cockpit-cv-x' };
    const orchSession = session(S1, { area: 'dfl' });
    const other = session(S2, { area: 'dfl' });
    const tree = buildChainTree([orchSession, other], [], new Set(), orchInfo);
    expect(tree.node?.ref).toBe(S1);
    const area = tree.children[0];
    expect(area.children.map((c) => c.node?.ref)).toEqual([S2]);
  });
});

describe('countRunning / hasLiveSession', () => {
  it('counts only RUNNING descendants, at any depth', () => {
    const parent = session(S1, { area: 'dfl' });
    const child = session(S2, { area: 'dfl', parentSessionId: S1 });
    const tree = buildChainTree([parent, child], [], new Set([S2]));
    const area = tree.children[0];
    expect(countRunning(area, new Set([S2]))).toBe(1);
    expect(countRunning(area, new Set())).toBe(0);
  });

  it('hasLiveSession is true for running OR waiting, false when neither', () => {
    const idle = session(S1, { area: 'dfl' });
    const tree = buildChainTree([idle], [], new Set());
    expect(hasLiveSession(tree.children[0], new Set())).toBe(false);
    expect(hasLiveSession(tree.children[0], new Set([S1]))).toBe(true);

    const waiting = session(S2, { area: 'itera', waiting: true });
    const tree2 = buildChainTree([waiting], [], new Set());
    expect(hasLiveSession(tree2.children[0], new Set())).toBe(true);
  });
});

describe('estimateAreaHeight', () => {
  it('sums one row per session in the subtree, regardless of nesting, plus the header', () => {
    const parent = session(S1, { area: 'dfl' });
    const child = session(S2, { area: 'dfl', parentSessionId: S1 });
    const tree = buildChainTree([parent, child], [], new Set());
    const area = tree.children[0];
    const expected = CHAIN_AREA_H + CHAIN_SESSION_GAP + 2 * (CHAIN_SESSION_H + CHAIN_SESSION_GAP);
    expect(estimateAreaHeight(area)).toBe(expected);
  });
});

describe('layoutChainTree', () => {
  it('lays areas out as fixed-width COLUMNS side by side, sessions stacked vertically inside', () => {
    const a = session(S1, { area: 'dfl' });
    const b = session(S2, { area: 'itera' });
    const tree = buildChainTree([a, b], [], new Set());
    const { positions } = layoutChainTree(tree, { collapsedAreas: new Set(), collapsedSessions: new Set() });
    const areaDfl = positions.find((p) => p.id === 'area:dfl')!;
    const areaItera = positions.find((p) => p.id === 'area:itera')!;
    const sessDfl = positions.find((p) => p.id === `s:${S1}`)!;
    const sessItera = positions.find((p) => p.id === `s:${S2}`)!;

    expect(areaDfl.width).toBe(CHAIN_AREA_W);
    expect(areaDfl.height).toBe(CHAIN_AREA_H);
    expect(areaItera.x).toBe(areaDfl.x + CHAIN_AREA_W + CHAIN_AREA_GAP); // side by side, fixed pitch
    expect(areaDfl.y).toBe(areaItera.y); // same row

    // session sits directly under its OWN area's column, not off to the side
    expect(sessDfl.x).toBe(areaDfl.x);
    expect(sessItera.x).toBe(areaItera.x);
    expect(sessDfl.y).toBeGreaterThan(areaDfl.y); // stacked below the header, same column
  });

  it('stacks a fork/flow child directly beneath its parent in the SAME column, indented', () => {
    const parent = session(S1, { area: 'dfl' });
    const child = session(S2, { area: 'dfl', parentSessionId: S1 });
    const tree = buildChainTree([parent, child], [], new Set());
    const { positions } = layoutChainTree(tree, { collapsedAreas: new Set(), collapsedSessions: new Set() });
    const parentPos = positions.find((p) => p.id === `s:${S1}`)!;
    const childPos = positions.find((p) => p.id === `s:${S2}`)!;
    expect(childPos.y).toBe(parentPos.y + CHAIN_SESSION_H + CHAIN_SESSION_GAP); // directly below, not a sibling row
    expect(childPos.x).toBeGreaterThan(parentPos.x); // indented
    expect(childPos.width).toBeLessThan(parentPos.width); // narrower to fit the column
  });

  it('centers the orchestrator root over the full column span', () => {
    const a = session(S1, { area: 'dfl' });
    const b = session(S2, { area: 'itera' });
    const tree = buildChainTree([a, b], [], new Set());
    const { positions } = layoutChainTree(tree, { collapsedAreas: new Set(), collapsedSessions: new Set() });
    const root = positions.find((p) => p.id === 'orchestrator')!;
    const areaDfl = positions.find((p) => p.id === 'area:dfl')!;
    const areaItera = positions.find((p) => p.id === 'area:itera')!;
    const spanCenter = (areaDfl.x + areaItera.x + CHAIN_AREA_W) / 2;
    expect(root.x + root.width / 2).toBeCloseTo(spanCenter);
    expect(root.y).toBe(0);
  });

  it('treats a collapsed branch as a leaf and reports its descendant count', () => {
    const parent = session(S1, { area: 'dfl' });
    const child = session(S2, { area: 'dfl', parentSessionId: S1 });
    const tree = buildChainTree([parent, child], [], new Set());
    const { positions } = layoutChainTree(tree, { collapsedAreas: new Set(), collapsedSessions: new Set([`s:${S1}`]) });
    const parentPos = positions.find((p) => p.id === `s:${S1}`)!;
    expect(parentPos.collapsed).toBe(true);
    expect(parentPos.descendantCount).toBe(1);
    expect(positions.find((p) => p.id === `s:${S2}`)).toBeUndefined();
  });

  it('collapsing an area hides its whole subtree from the position list', () => {
    const a = session(S1, { area: 'dfl' });
    const tree = buildChainTree([a], [], new Set());
    const { positions } = layoutChainTree(tree, { collapsedAreas: new Set(['dfl']), collapsedSessions: new Set() });
    expect(positions.map((p) => p.id).sort()).toEqual(['area:dfl', 'orchestrator']);
    expect(positions.find((p) => p.id === 'area:dfl')?.descendantCount).toBe(1);
    expect(positions.find((p) => p.id === 'area:dfl')?.height).toBe(CHAIN_AREA_H); // collapsed: header only, not the whole column
  });

  it('keeps the overall width to the fixed column pitch, not proportional to session count', () => {
    const many = Array.from({ length: 12 }, (_, i) => session(`sess-${i}`, { area: 'dfl' }));
    const tree = buildChainTree(many, [], new Set());
    const { width } = layoutChainTree(tree, { collapsedAreas: new Set(), collapsedSessions: new Set() });
    expect(width).toBe(Math.max(CHAIN_AREA_W, CHAIN_ROOT_W)); // one area column regardless of how many sessions stack inside it
  });

  it('root height never depends on how tall the tallest column is', () => {
    const tree = buildChainTree([session(S1, { area: 'dfl' })], [], new Set());
    const { positions } = layoutChainTree(tree, { collapsedAreas: new Set(), collapsedSessions: new Set() });
    expect(positions.find((p) => p.id === 'orchestrator')?.height).toBe(CHAIN_ROOT_H);
  });
});
