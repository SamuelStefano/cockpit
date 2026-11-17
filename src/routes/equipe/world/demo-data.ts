import type { TeamState, TeamStateBot } from '../../../../shared/team-state';

const bot = (id: string, name: string, status: TeamStateBot['status'], task?: string): TeamStateBot => ({ id, name, role: 'demo', status, ...(task ? { task } : {}) });

export const DEMO_BOTS: TeamStateBot[] = [
  bot('iris', 'Íris', 'working'),
  bot('otto', 'Otto', 'idle'),
  bot('luffy', 'Luffy', 'working', 'Itera'),
  bot('zoro', 'Zoro', 'working', 'DFL'),
  bot('raquel', 'Raquel', 'waiting'),
  bot('anderson', 'Anderson', 'working', 'Corte Radar'),
  bot('lara', 'Lara', 'idle'),
  bot('lorena', 'Lorena', 'idle'),
  bot('goku', 'Goku', 'working', 'Deck'),
  bot('nami', 'Nami', 'working', 'Deck'),
  bot('arthur', 'Arthur', 'working', 'Itera'),
  bot('mari', 'Mari', 'idle'),
  bot('usopp', 'Usopp', 'idle'),
  bot('robin', 'Robin', 'idle'),
  bot('bulma', 'Bulma', 'working', 'DFL'),
  bot('ada', 'Ada', 'working', 'DFL'),
];

export const DEMO_PROJECTS: Record<string, number> = { itera: 4, dfl: 6, 'corte-radar': 1 };

// Who sits in the demo meeting (?meeting=1 or after Convocar in demo).
export const DEMO_MEETING = ['luffy', 'zoro', 'raquel', 'lara'];

export const DEMO_COUNTS: Record<string, number> = { iris: 4, luffy: 2, anderson: 7, arthur: 1, ada: 3, raquel: 2 };

// Pairs the demo cycles through to keep handoff items flying.
const PAIRS: readonly (readonly [string, string])[] = [['iris', 'luffy'], ['anderson', 'ada'], ['arthur', 'raquel'], ['ada', 'iris']];

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
