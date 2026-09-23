import { describe, it, expect } from 'vitest';
import type { CanvasEdge, CanvasNode } from '../../../shared/canvas';
import { aliveAt, ALIVE_PAD_MS, fmtTimelineStamp, pastAliveIds, pastExecIds } from './canvas-timeline';

describe('aliveAt', () => {
  it('is alive strictly inside an activity interval', () => {
    expect(aliveAt({ activity: [[1000, 2000]] }, 1500)).toBe(true);
  });

  it('is alive just before/after an interval, within the pad', () => {
    expect(aliveAt({ activity: [[10_000, 20_000]] }, 10_000 - ALIVE_PAD_MS)).toBe(true);
    expect(aliveAt({ activity: [[10_000, 20_000]] }, 20_000 + ALIVE_PAD_MS)).toBe(true);
  });

  it('is not alive just past the pad', () => {
    expect(aliveAt({ activity: [[10_000, 20_000]] }, 10_000 - ALIVE_PAD_MS - 1)).toBe(false);
    expect(aliveAt({ activity: [[10_000, 20_000]] }, 20_000 + ALIVE_PAD_MS + 1)).toBe(false);
  });

  it('is not alive with no activity at all', () => {
    expect(aliveAt({}, 1500)).toBe(false);
    expect(aliveAt({ activity: [] }, 1500)).toBe(false);
  });

  it('checks every interval, not just the first', () => {
    expect(aliveAt({ activity: [[0, 100], [5000, 6000]] }, 5500)).toBe(true);
  });

  it('a running turn spans T once it starts, even with no activity recorded yet', () => {
    expect(aliveAt({}, 5000, 4000)).toBe(true);
    expect(aliveAt({}, 3000, 4000)).toBe(false); // T before the turn started
  });
});

describe('fmtTimelineStamp', () => {
  it('formats in BRT (UTC-3), independent of the runner\'s own timezone', () => {
    // 2026-09-23T15:00:00Z -> 12:00 in America/Sao_Paulo (UTC-3, no DST since 2019).
    expect(fmtTimelineStamp(Date.parse('2026-09-23T15:00:00Z'))).toBe('23/09, 12:00');
  });
});

describe('pastAliveIds', () => {
  const node = (id: string, kind: CanvasNode['kind'], activity?: [number, number][]): CanvasNode =>
    ({ id, kind, ref: id, title: id, subtitle: '', mtime: 0, activity });
  const edge = (source: string, target: string, kind: CanvasEdge['kind']): CanvasEdge => ({ source, target, kind });

  it('includes an alive session and a context it touched', () => {
    const nodes = [node('s:1', 'session', [[0, 100]]), node('c:a', 'context')];
    const edges = [edge('s:1', 'c:a', 'write')];
    expect(pastAliveIds(nodes, edges, 50, {})).toEqual(new Set(['s:1', 'c:a']));
  });

  it('does NOT spread aliveness through a conflict edge (session -> session)', () => {
    const nodes = [node('s:1', 'session', [[0, 100]]), node('s:2', 'session')]; // s:2 has no activity of its own
    const edges = [edge('s:1', 's:2', 'conflict')];
    expect(pastAliveIds(nodes, edges, 50, {})).toEqual(new Set(['s:1']));
  });

  it('does not spread session -> session even over a non-conflict edge kind', () => {
    const nodes = [node('s:1', 'session', [[0, 100]]), node('s:2', 'session')];
    const edges = [edge('s:1', 's:2', 'read')];
    expect(pastAliveIds(nodes, edges, 50, {})).toEqual(new Set(['s:1']));
  });

  it('a session alive only via a running turn still spreads to its context', () => {
    const nodes = [node('s:1', 'session'), node('c:a', 'context')];
    const edges = [edge('s:1', 'c:a', 'write')];
    expect(pastAliveIds(nodes, edges, 50, { 's:1': 10 })).toEqual(new Set(['s:1', 'c:a']));
  });

  it('excludes a session with no activity and nothing that makes it alive', () => {
    const nodes = [node('s:1', 'session'), node('c:a', 'context')];
    const edges = [edge('s:1', 'c:a', 'write')];
    expect(pastAliveIds(nodes, edges, 50, {})).toEqual(new Set());
  });
});

describe('pastExecIds', () => {
  const node = (id: string, kind: CanvasNode['kind'], activity?: [number, number][], extra: Partial<CanvasNode> = {}): CanvasNode =>
    ({ id, kind, ref: id, title: id, subtitle: '', mtime: 0, activity, ...extra });
  const edge = (source: string, target: string, kind: CanvasEdge['kind']): CanvasEdge => ({ source, target, kind });

  it('includes a session alive at T even if it is idle right now (the exec-scope bug)', () => {
    const nodes = [node('s:1', 'session', [[0, 100]])];
    expect(pastExecIds(nodes, [], 50, {})).toEqual(new Set(['s:1']));
  });

  it('excludes a session not alive at T', () => {
    const nodes = [node('s:1', 'session', [[0, 100]])];
    expect(pastExecIds(nodes, [], 100 + ALIVE_PAD_MS + 1, {})).toEqual(new Set());
  });

  it('includes a context the alive session directly touched via read/write', () => {
    const nodes = [node('s:1', 'session', [[0, 100]]), node('c:a', 'context')];
    const edges = [edge('s:1', 'c:a', 'write')];
    expect(pastExecIds(nodes, edges, 50, {})).toEqual(new Set(['s:1', 'c:a']));
  });

  it('does NOT spread through a topic/link edge (no hub-promotion, unlike the "active" scope)', () => {
    const nodes = [node('s:1', 'session', [[0, 100]]), node('c:a', 'context')];
    const edges = [edge('s:1', 'c:a', 'topic')];
    expect(pastExecIds(nodes, edges, 50, {})).toEqual(new Set(['s:1']));
  });

  it('includes the card that launched an alive session, reversing the card->session edge', () => {
    const nodes = [node('s:1', 'session', [[0, 100]]), node('k:c1', 'card')];
    const edges = [edge('k:c1', 's:1', 'card')];
    expect(pastExecIds(nodes, edges, 50, {})).toEqual(new Set(['s:1', 'k:c1']));
  });

  it('keeps the launching card even when the session is no longer alive at T (card excluded once session drops)', () => {
    const nodes = [node('s:1', 'session', [[0, 100]]), node('k:c1', 'card')];
    const edges = [edge('k:c1', 's:1', 'card')];
    expect(pastExecIds(nodes, edges, 100 + ALIVE_PAD_MS + 1, {})).toEqual(new Set());
  });

  it('a session alive only via a running turn still pulls its context and card', () => {
    const nodes = [node('s:1', 'session'), node('c:a', 'context'), node('k:c1', 'card')];
    const edges = [edge('s:1', 'c:a', 'read'), edge('k:c1', 's:1', 'card')];
    expect(pastExecIds(nodes, edges, 50, { 's:1': 10 })).toEqual(new Set(['s:1', 'c:a', 'k:c1']));
  });

  // review #600: the past view must respect the SAME automation/archived
  // filters the live exec scope already does (canvas-filter.ts) — otherwise
  // scrubbing back resurrects noise the user explicitly hid.
  it('hides an automation session by default, and shows it when asked (showAutomation)', () => {
    const nodes = [node('s:ping', 'session', [[0, 100]], { title: '.', subtitle: '' })];
    expect(pastExecIds(nodes, [], 50, {})).toEqual(new Set());
    expect(pastExecIds(nodes, [], 50, {}, { showAutomation: true })).toEqual(new Set(['s:ping']));
  });

  it('excludes an archived session by default, and includes it with archived:true', () => {
    const nodes = [node('s:1', 'session', [[0, 100]], { archived: true })];
    expect(pastExecIds(nodes, [], 50, {})).toEqual(new Set());
    expect(pastExecIds(nodes, [], 50, {}, { archived: true })).toEqual(new Set(['s:1']));
  });

  it('a currently-running session is exempt from the archived filter even with archived:false', () => {
    const nodes = [node('s:1', 'session', [[0, 100]], { archived: true })];
    expect(pastExecIds(nodes, [], 50, {}, { running: new Set(['s:1']) })).toEqual(new Set(['s:1']));
  });

  it('also excludes an archived context the alive session touched', () => {
    const nodes = [node('s:1', 'session', [[0, 100]]), node('c:a', 'context', undefined, { archived: true })];
    const edges = [edge('s:1', 'c:a', 'write')];
    expect(pastExecIds(nodes, edges, 50, {})).toEqual(new Set(['s:1']));
    expect(pastExecIds(nodes, edges, 50, {}, { archived: true })).toEqual(new Set(['s:1', 'c:a']));
  });
});
