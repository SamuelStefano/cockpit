import type { TeamState, TeamStateBot } from '../../../../shared/team-state';

const bot = (id: string, name: string, status: TeamStateBot['status'], task?: string): TeamStateBot => ({ id, name, role: 'demo', status, ...(task ? { task } : {}) });

export const DEMO_BOTS: TeamStateBot[] = [
  bot('iris', 'Íris', 'working'),
  bot('otto', 'Otto', 'idle'),
  bot('teo', 'Téo', 'working', 'Itera'),
  bot('davi', 'Davi', 'working', 'DFL'),
  bot('rita', 'Rita', 'waiting'),
  bot('caio', 'Caio', 'working', 'Corte Radar'),
  bot('lina', 'Lina', 'idle'),
  bot('sara', 'Sara', 'idle'),
  bot('gui', 'Gui', 'working', 'Itera'),
  bot('bia', 'Bia', 'idle'),
  bot('ada', 'Ada', 'working', 'DFL'),
];

export const DEMO_PROJECTS: Record<string, number> = { itera: 4, dfl: 6, 'corte-radar': 1 };

// Who sits in the demo meeting (?meeting=1 or after Convocar in demo).
export const DEMO_MEETING = ['teo', 'davi', 'rita', 'lina'];

export const DEMO_COUNTS: Record<string, number> = { iris: 4, teo: 2, caio: 7, gui: 1, ada: 3, rita: 2 };

// Pairs the demo cycles through to keep handoff items flying.
const PAIRS: readonly (readonly [string, string])[] = [['iris', 'teo'], ['caio', 'ada'], ['gui', 'rita'], ['ada', 'iris']];

export function demoTeamState(now: number, tick = 0): TeamState {
  const [from, to] = PAIRS[tick % PAIRS.length]!;
  return {
    at: now,
    followUpHours: 4,
    bots: DEMO_BOTS,
    handoffs: [{ from, to, point: 'demo', at: now, taskId: `demo-${tick}` }],
    followUps: [],
  };
}
