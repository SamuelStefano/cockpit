import { describe, it, expect } from 'vitest';
import type { TeamState } from '../../../../shared/team-state';
import { badgeText, deriveWorld, npcSprite, projectOf, stationOf } from './world-state';

const state = (over: Partial<TeamState> = {}): TeamState => ({
  at: 1_000_000,
  followUpHours: 4,
  bots: [
    { id: 'a', name: 'Íris', role: 'cargo', status: 'working', task: 'secret task text', lastSend: { to: 'b', at: 1, preview: 'secret preview' } },
    { id: 'b', name: 'Otto', role: 'cargo', status: 'idle' },
    { id: 'c', name: 'Luffy', role: 'cargo', status: 'waiting', project: 'itera' },
  ],
  handoffs: [],
  followUps: [],
  ...over,
});

describe('npcSprite', () => {
  it('maps each status to an animation and bubble', () => {
    expect(npcSprite('working')).toEqual({ anim: 'work', bubble: null, tool: true });
    expect(npcSprite('idle')).toEqual({ anim: 'idle', bubble: 'zz', tool: false });
    expect(npcSprite('waiting')).toEqual({ anim: 'wait', bubble: '!', tool: false });
  });
});

describe('badgeText', () => {
  it('hides missing and zero counts, caps large ones', () => {
    expect(badgeText(undefined)).toBeNull();
    expect(badgeText(0)).toBeNull();
    expect(badgeText(NaN)).toBeNull();
    expect(badgeText(7)).toBe('7');
    expect(badgeText(250)).toBe('99+');
  });
});

describe('deriveWorld', () => {
  it('returns an empty world without a snapshot', () => {
    expect(deriveWorld(null)).toEqual({ npcs: [], flights: [], projects: {}, meetingSize: 0 });
  });

  it('keeps only name, mode and badge per bot', () => {
    const w = deriveWorld(state(), { counts: { a: 3 } });
    expect(w.npcs).toEqual([
      { id: 'a', name: 'Íris', mode: 'working', badge: '3', project: 'escritorio', meeting: false },
      { id: 'b', name: 'Otto', mode: 'idle', badge: null, project: 'escritorio', meeting: false },
      { id: 'c', name: 'Luffy', mode: 'waiting', badge: null, project: 'itera', meeting: false },
    ]);
    const dump = JSON.stringify(w);
    expect(dump).not.toContain('secret');
  });

  it('formats project counts and hides empty ones', () => {
    expect(deriveWorld(state(), { projects: { itera: 4, dfl: 0 } }).projects).toEqual({ itera: '4' });
  });

  it('shows no badges with real data: counts only come from the demo', () => {
    const w = deriveWorld(state({ bots: [{ id: 'z', name: 'Luffy', role: 'r', status: 'working', project: 'itera' }] }));
    expect(w.projects).toEqual({});
    expect(w.npcs[0]?.badge).toBeNull();
  });

  it('turns recent handoffs into flights and drops stale or unknown ones', () => {
    const w = deriveWorld(state({
      handoffs: [
        { from: 'a', to: 'b', point: 'secret point', at: 999_000, taskId: 't1' },
        { to: 'c', point: 'x', at: 999_500, taskId: 't2' },
        { from: 'a', to: 'ghost', point: 'x', at: 999_900, taskId: 't3' },
        { from: 'a', to: 'b', point: 'x', at: 1_000_000 - 3_600_000, taskId: 't4' },
      ],
    }));
    expect(w.flights).toEqual([
      { key: 't1:999000', from: 'a', to: 'b' },
      { key: 't2:999500', from: null, to: 'c' },
    ]);
    expect(JSON.stringify(w)).not.toContain('secret');
  });
});

describe('projectOf', () => {
  const houses = [{ id: 'itera' }, { id: 'dfl' }, { id: 'corte-radar' }, { id: 'eng-hall', department: 'engineering' }];

  it('lets the project field win over task and department', () => {
    expect(projectOf({ project: 'dfl', task: 'itera work', sector: 'engineering' }, houses)).toBe('dfl');
  });

  it('ignores an unknown project and falls through', () => {
    expect(projectOf({ project: 'nope' }, houses)).toBe('escritorio');
    expect(projectOf({ project: 'nope', task: 'fix radar crop' }, houses)).toBe('corte-radar');
  });

  it('uses a task keyword only when that house exists', () => {
    expect(projectOf({ task: 'DFL invoice' }, houses)).toBe('dfl');
    expect(projectOf({ task: 'DFL invoice' }, [{ id: 'itera' }])).toBe('escritorio');
  });

  it('falls back to the house of the bot department', () => {
    expect(projectOf({ sector: 'engineering' }, houses)).toBe('eng-hall');
    expect(projectOf({ sector: 'growth' }, houses)).toBe('escritorio');
  });

  it('falls back to the office', () => {
    expect(projectOf({}, houses)).toBe('escritorio');
  });

  it('resolves through the real map in deriveWorld', () => {
    const w = deriveWorld(state({ bots: [{ id: 'z', name: 'X', role: 'r', status: 'working', task: 'DFL invoice' }] }));
    expect(w.npcs[0]?.project).toBe('dfl');
  });
});

describe('stationOf', () => {
  it('sends working bots to their project, meeting bots to the room, others to the plaza', () => {
    expect(stationOf({ mode: 'working', project: 'dfl', meeting: false })).toBe('dfl');
    expect(stationOf({ mode: 'idle', project: 'dfl', meeting: false })).toBe('plaza');
    expect(stationOf({ mode: 'waiting', project: 'dfl', meeting: false })).toBe('plaza');
    expect(stationOf({ mode: 'idle', project: 'dfl', meeting: true })).toBe('sala');
    expect(stationOf({ mode: 'working', project: 'dfl', meeting: true })).toBe('sala');
  });

  it('marks meeting participants from the running meeting only', () => {
    const w = deriveWorld(state(), { meeting: { participantIds: ['a', 'zzz'] } });
    expect(w.meetingSize).toBe(1);
    expect(w.npcs.map((n) => n.meeting)).toEqual([true, false, false]);
  });
});
