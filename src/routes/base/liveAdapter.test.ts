import { describe, expect, it } from 'vitest';
import type { Message } from '../../data/types';
import type { CanvasCard } from '../../../shared/canvas';
import { adaptLive, emptyPlacement, familyOf, LIVE_AGENT_CAP, nextCronRun, placeSessions, projectOf, type LiveInput } from './liveAdapter';

const NOW = 1_800_000_000_000;
const input = (over: Partial<LiveInput> = {}): LiveInput => ({ sessions: [], running: new Set(), termStats: {}, threads: {}, tails: {}, teamQuestions: [], areas: {}, cards: null, stats: null, crons: null, mcpServers: null, answered: {}, now: NOW, ...over });
const sess = (id: string, over = {}) => ({ id, title: `Deck: ${id}`, mtime: NOW - 1000, ...over });
const card = (id: string, status: CanvasCard['status']): CanvasCard => ({ id, title: id, prompt: '', status, kind: 'task', contextIds: [], sessionIds: [], createdAt: 0, updatedAt: 0 });
const asking: Message[] = [{ id: 'a', role: 'assistant', blocks: [{ type: 'tool', tool: { id: 't', name: 'AskUserQuestion', status: 'done', output: [], questions: [{ question: 'Ship it?', header: 'h', multiSelect: false, options: [{ label: 'Yes (recommended)' }, { label: 'Other' }] }] } }] } as unknown as Message];

describe('projectOf', () => {
  it('reads a title prefix and falls back to General', () => {
    expect(projectOf('Itera: new kind')).toEqual({ id: 'itera', name: 'Itera' });
    expect(projectOf('[deck] relay')).toEqual({ id: 'deck', name: 'Deck' });
    expect(projectOf('fix the thing')).toEqual({ id: 'general', name: 'General' });
    expect(projectOf('whatever', 'dfl').id).toBe('dfl');
  });
});

describe('familyOf', () => {
  it('never guesses a model', () => {
    expect(familyOf('claude-opus-4')).toBe('opus');
    expect(familyOf(undefined)).toBe('unknown');
  });
});

describe('placeSessions', () => {
  it('keeps desks stable and reuses only freed slots', () => {
    const a = placeSessions(emptyPlacement(), [{ id: '1', project: 'x' }, { id: '2', project: 'x' }, { id: '3', project: 'y' }]);
    const b = placeSessions(a, [{ id: '2', project: 'x' }, { id: '4', project: 'x' }, { id: '3', project: 'y' }]);
    expect(b.slots.x['2']).toBe(a.slots.x['2']);
    expect(b.slots.x['4']).toBe(a.slots.x['1']);
    expect(b.order).toEqual(['x', 'y']);
  });
});

describe('adaptLive', () => {
  it('maps running, idle and waiting to real states', () => {
    const r = adaptLive(input({ sessions: [sess('run'), sess('idle'), sess('ask', { waiting: true })], running: new Set(['run']) }), emptyPlacement());
    const by = Object.fromEntries(r.floor.agents.map((a) => [a.sessionId, a.state]));
    expect(by).toEqual({ run: 'working', idle: 'waiting', ask: 'blocked' });
  });

  it('caps the floor and reports the rest as elsewhere', () => {
    const sessions = Array.from({ length: LIVE_AGENT_CAP + 5 }, (_, i) => sess(`s${i}`));
    const r = adaptLive(input({ sessions }), emptyPlacement());
    expect(r.floor.agents).toHaveLength(LIVE_AGENT_CAP);
    expect(r.elsewhere).toBe(5);
  });

  it('shows the real question and sends the clean option label', () => {
    const r = adaptLive(input({ sessions: [sess('q', { waiting: true })], threads: { q: asking } }), emptyPlacement());
    const d = r.decisions[0];
    expect(d.what).toBe('Ship it?');
    expect(d.opts[0].label).toBe('Yes');
    expect(d.actions[0]).toEqual({ kind: 'answer', sessionId: 'q', text: 'Yes' });
    expect(d.actions[1].kind).toBe('open');
  });

  it('admits it does not know a question that has not loaded, and asks for the thread', () => {
    const r = adaptLive(input({ sessions: [sess('q', { waiting: true })] }), emptyPlacement());
    expect(r.decisions[0].why).toBe('Question text unknown.');
    expect(r.decisions[0].actions).toEqual([{ kind: 'open', sessionId: 'q' }]);
    expect(r.missingThreads).toEqual(['q']);
  });

  it('raises a chat-only decision at 80% context', () => {
    const r = adaptLive(input({ sessions: [sess('c')], termStats: { c: { contextTokens: 170_000, model: 'claude-sonnet-4-5' } } }), emptyPlacement());
    expect(r.decisions[0].type).toBe('context');
    expect(r.decisions[0].actions).toEqual([{ kind: 'open', sessionId: 'c' }]);
    expect(r.floor.agents[0].ctx).toBeCloseTo(0.85);
  });

  it('never fabricates: no model, no tail, no crates, no board numbers without data', () => {
    const r = adaptLive(input({ sessions: [sess('x')] }), emptyPlacement());
    const a = r.floor.agents[0];
    expect(a.modelLabel).toBe('unknown');
    expect(a.ctx).toBeNull();
    expect(a.monitor).toMatchObject({ kind: 'live', tail: null });
    expect(r.floor.crates).toEqual([]);
    expect(r.floor.mountainLabel).toBe('BOARD NOT LOADED');
    expect(r.floor.mountainCount).toBe(0);
    expect(r.floor.racks[0].disk).toBeNull();
    expect(r.floor.clockLabel).toBe('NEXT RUN UNKNOWN');
    expect(r.floor.machineLabel).toBe('MCP: UNKNOWN');
  });

  it('sizes the mountain and the belt from the real board', () => {
    const r = adaptLive(input({ cards: [card('a', 'review'), card('b', 'review'), card('c', 'done'), card('d', 'todo')] }), emptyPlacement());
    expect(r.floor.mountainCount).toBe(2);
    expect(r.floor.mountainLabel).toBe('2 CARDS IN REVIEW · 1 DONE');
    expect(r.floor.crates).toHaveLength(4);
    expect(r.floor.stations.map((s) => s.label)).toEqual(['TODO 1', 'DOING 0', 'REVIEW 2', 'DONE 1']);
  });

  it('hides a question once answered, until the session moves on', () => {
    const s = sess('q', { waiting: true });
    expect(adaptLive(input({ sessions: [s], answered: { q: s.mtime } }), emptyPlacement()).decisions).toEqual([]);
    expect(adaptLive(input({ sessions: [s], answered: { q: 1 } }), emptyPlacement()).decisions).toHaveLength(1);
  });
});

describe('nextCronRun', () => {
  const base = { id: 'c', name: 'c', prompt: '', enabled: true, createdAt: NOW };
  it('ignores disabled crons and computes intervals', () => {
    expect(nextCronRun({ ...base, enabled: false, schedule: { kind: 'interval', everyMinutes: 5 } }, NOW)).toBeNull();
    expect(nextCronRun({ ...base, schedule: { kind: 'interval', everyMinutes: 5 } }, NOW)).toBe(NOW + 300000);
  });
});

describe('live floor grouping from the real test', () => {
  it('ignores generic areas and infers the project from the title', () => {
    expect(projectOf('Revisar o kanban do deck', 'Outros').id).toBe('deck');
    expect(projectOf('Bug grave no iterahq.dev').id).toBe('itera');
    expect(projectOf('Algo sem projeto', 'Others').id).toBe('general');
  });
  it('puts running sessions first and caps idle desks', () => {
    const now = 1e9;
    const sessions = Array.from({ length: 12 }, (_, i) => ({ id: `i${i}`, title: 'Idle work', mtime: now - 1000 * (i + 1) }));
    const old = { id: 'r', title: 'Old but running', mtime: now - 9e8 };
    const { shown } = pickSessions({ sessions: [...sessions, old], running: new Set(['r']), now });
    expect(shown[0].id).toBe('r');
    expect(shown).toHaveLength(7);
  });
});
