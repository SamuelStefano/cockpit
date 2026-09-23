import { describe, expect, it } from 'vitest';
import type { CanvasEdge, CanvasNode, TermStats } from '../../../shared/canvas';
import {
  HEADROOM_LIMIT_PCT, MIN_OVERLAP_PCT, buildReason, contextsTouched, defaultReuseMode, headroomOk, overlapPct, rankReuseCandidates,
} from './session-reuse';

const session = (ref: string, over: Partial<CanvasNode> = {}): CanvasNode => ({
  id: `s:${ref}`, kind: 'session', ref, title: `Sessão ${ref}`, subtitle: '', mtime: 1000, ...over,
});

const edge = (source: string, target: string, kind: CanvasEdge['kind']): CanvasEdge => ({ source, target, kind });

describe('contextsTouched / overlapPct', () => {
  it('collects only read/write/topic edges sourced from the session', () => {
    const edges = [
      edge('s:abc', 'c:hub_deck', 'read'),
      edge('s:abc', 'c:hub_pessoal', 'write'),
      edge('s:abc', 'c:hub_dfl', 'topic'),
      edge('s:abc', 'k:card-1', 'card'), // not a context edge
      edge('s:other', 'c:hub_deck', 'read'), // different session
    ];
    expect(contextsTouched(edges, 'abc')).toEqual(new Set(['hub_deck', 'hub_pessoal', 'hub_dfl']));
  });

  it('overlap is the share of the CARD contexts the session touched', () => {
    const touched = new Set(['hub_deck', 'hub_dfl']);
    expect(overlapPct(['hub_deck', 'hub_dfl', 'hub_pessoal', 'hub_infra'], touched)).toBe(50);
    expect(overlapPct([], touched)).toBe(0);
  });
});

describe('buildReason', () => {
  it('joins overlap, context% and age in pt-BR', () => {
    expect(buildReason(2, 3, 34, 2 * 3_600_000)).toBe('tocou 2 de 3 contextos · 34% de contexto · há 2h');
  });
  it('omits context% when unknown (no TermStats yet, not zero)', () => {
    expect(buildReason(1, 1, null, 30_000)).toBe('tocou 1 de 1 contexto · há 1min');
  });
});

describe('headroomOk', () => {
  // review #597 point 2: an unknown ctx (no TermStats fetched for this
  // candidate yet) must NEVER read as "ok" — that would let the default
  // silently fork into a session nobody actually measured.
  it('null (unknown) is never ok', () => {
    expect(headroomOk(null)).toBe(false);
  });
  it('a real number under the limit is ok; at/above the limit is not', () => {
    expect(headroomOk(HEADROOM_LIMIT_PCT - 1)).toBe(true);
    expect(headroomOk(HEADROOM_LIMIT_PCT)).toBe(false);
  });
});

describe('rankReuseCandidates', () => {
  const now = 10_000_000;
  const cardCtx = { contextIds: ['hub_deck', 'hub_dfl'] };

  it('excludes cron-ping and zero-overlap idle sessions, keeps zero-overlap RUNNING ones', () => {
    const sessions = [
      session('ping', { title: '.', subtitle: '.' }),
      session('idle-noise'), // no edges at all -> 0 overlap, not running
      session('live-empty'), // 0 overlap but running
    ];
    const out = rankReuseCandidates({ card: cardCtx, sessions, edges: [], running: new Set(['live-empty']), termStats: {}, now });
    expect(out.map((c) => c.sessionId)).toEqual(['live-empty']);
    expect(out[0].running).toBe(true);
  });

  it('sorts headroom-ok candidates above a near-full one regardless of overlap', () => {
    const sessions = [session('hot'), session('cool')];
    const edges = [edge('s:hot', 'c:hub_deck', 'read'), edge('s:hot', 'c:hub_dfl', 'read'), edge('s:cool', 'c:hub_deck', 'read')];
    const termStats: Record<string, TermStats> = {
      hot: { cpu: 0, rssMb: 0, procs: 0, contextTokens: 190_000, model: 'claude-sonnet-5' }, // ~95%
      cool: { cpu: 0, rssMb: 0, procs: 0, contextTokens: 20_000, model: 'claude-sonnet-5' }, // ~10%
    };
    const out = rankReuseCandidates({ card: cardCtx, sessions, edges, running: new Set(), termStats, now });
    expect(out.map((c) => c.sessionId)).toEqual(['cool', 'hot']);
    expect(out[0].ctxPctUsed).toBeLessThan(HEADROOM_LIMIT_PCT);
  });

  // review #597 point 2: before the fix, a null ctx read as "ok" and could
  // outrank (or tie with) a session with REAL, known-good headroom — a
  // session nobody has measured must never look safer than one that is.
  it('a known-good candidate outranks one with unknown ctx, even with lower overlap', () => {
    const sessions = [session('unknown-ctx'), session('known-good')];
    const edges = [
      edge('s:unknown-ctx', 'c:hub_deck', 'read'), edge('s:unknown-ctx', 'c:hub_dfl', 'read'), // 100% overlap, no stats
      edge('s:known-good', 'c:hub_deck', 'read'), // 50% overlap, real low ctx
    ];
    const termStats: Record<string, TermStats> = {
      'known-good': { cpu: 0, rssMb: 0, procs: 0, contextTokens: 10_000, model: 'claude-sonnet-5' },
    };
    const out = rankReuseCandidates({ card: cardCtx, sessions, edges, running: new Set(), termStats, now });
    expect(out.map((c) => c.sessionId)).toEqual(['known-good', 'unknown-ctx']);
  });

  it('within headroom, higher overlap wins; ties break on recency', () => {
    const sessions = [
      session('full-match', { mtime: now - 5 * 3_600_000 }),
      session('partial-match', { mtime: now - 3_600_000 }),
    ];
    const edges = [
      edge('s:full-match', 'c:hub_deck', 'read'), edge('s:full-match', 'c:hub_dfl', 'write'),
      edge('s:partial-match', 'c:hub_deck', 'topic'),
    ];
    const out = rankReuseCandidates({ card: cardCtx, sessions, edges, running: new Set(), termStats: {}, now });
    expect(out.map((c) => c.sessionId)).toEqual(['full-match', 'partial-match']);
    expect(out[0].overlapPct).toBe(100);
  });

  it('caps at the top 3', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => session(`s${i}`));
    const edges = sessions.map((s) => edge(s.id, 'c:hub_deck', 'read'));
    const out = rankReuseCandidates({ card: { contextIds: ['hub_deck'] }, sessions, edges, running: new Set(), termStats: {}, now });
    expect(out).toHaveLength(3);
  });
});

describe('defaultReuseMode', () => {
  it('no candidate -> new session', () => {
    expect(defaultReuseMode(undefined)).toEqual({ mode: 'new' });
  });
  it('overlap >= MIN_OVERLAP_PCT and headroom ok -> fork (never "continue" by default)', () => {
    const top = { sessionId: 'x', title: 'X', running: false, overlapPct: MIN_OVERLAP_PCT, ctxPctUsed: 40, ageMs: 0, reason: '' };
    expect(defaultReuseMode(top)).toEqual({ mode: 'fork', sessionId: 'x' });
  });
  it('low overlap -> new session even with headroom', () => {
    const top = { sessionId: 'x', title: 'X', running: false, overlapPct: MIN_OVERLAP_PCT - 1, ctxPctUsed: 10, ageMs: 0, reason: '' };
    expect(defaultReuseMode(top)).toEqual({ mode: 'new' });
  });
  it('high context usage -> new session even with full overlap', () => {
    const top = { sessionId: 'x', title: 'X', running: false, overlapPct: 100, ctxPctUsed: HEADROOM_LIMIT_PCT, ageMs: 0, reason: '' };
    expect(defaultReuseMode(top)).toEqual({ mode: 'new' });
  });
  // review #597 point 2: unknown ctx must default to 'new', never guess a fork.
  it('unknown ctx (null) -> new session even with full overlap', () => {
    const top = { sessionId: 'x', title: 'X', running: false, overlapPct: 100, ctxPctUsed: null, ageMs: 0, reason: '' };
    expect(defaultReuseMode(top)).toEqual({ mode: 'new' });
  });
});
