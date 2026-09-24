import { describe, expect, it } from 'vitest';
import type { CanvasFlow, CanvasNode, OrchestratorInfo } from '../../../shared/canvas';
import { buildChainTree, layoutChainTree, sortSessions } from './chain-layout';

const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';
const S3 = '33333333-3333-3333-3333-333333333333';
const ORCH = '99999999-9999-9999-9999-999999999999';

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

describe('layoutChainTree', () => {
  it('centers a parent over its children and stacks depth into rows', () => {
    const a = session(S1, { area: 'dfl' });
    const b = session(S2, { area: 'dfl' });
    const tree = buildChainTree([a, b], [], new Set());
    const { positions } = layoutChainTree(tree, { collapsedAreas: new Set(), collapsedSessions: new Set() });
    const root = positions.find((p) => p.id === 'orchestrator')!;
    const area = positions.find((p) => p.id === 'area:dfl')!;
    const leaves = positions.filter((p) => p.item.kind === 'session');
    expect(leaves).toHaveLength(2);
    expect(area.x).toBeCloseTo((leaves[0].x + leaves[1].x) / 2);
    expect(root.x).toBeCloseTo(area.x);
    expect(root.depth).toBe(0);
    expect(area.depth).toBe(1);
    expect(leaves[0].depth).toBe(2);
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
  });
});
