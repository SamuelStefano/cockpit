import type { TeamState, TeamStateBot } from '../../../../shared/team-state';

const COLORS = ['#3fd17f', '#ff6b6b', '#4dabf7', '#ffd166', '#b69cff', '#ff9f43', '#38d9a9', '#f783ac'];
let colorIdx = 0;
const bot = (id: string, name: string, status: TeamStateBot['status'], project?: string): TeamStateBot => ({
  id, name, role: 'demo', status, color: COLORS[colorIdx++ % COLORS.length]!, ...(project ? { project } : {}),
});

export const DEMO_BOTS: TeamStateBot[] = [
  bot('iris', 'Íris', 'working'),
  bot('otto', 'Otto', 'idle'),
  bot('luffy', 'Luffy', 'working', 'itera'),
  bot('zoro', 'Zoro', 'working', 'dfl'),
  bot('raquel', 'Raquel', 'waiting'),
  bot('anderson', 'Anderson', 'working', 'corte-radar'),
  bot('lara', 'Lara', 'idle'),
  bot('lorena', 'Lorena', 'idle'),
  bot('goku', 'Goku', 'working', 'deck'),
  bot('nami', 'Nami', 'working', 'deck'),
  bot('arthur', 'Arthur', 'working', 'itera'),
  bot('mari', 'Mari', 'idle'),
  bot('usopp', 'Usopp', 'idle'),
  bot('malu', 'Malu', 'idle'),
  bot('robin', 'Robin', 'idle'),
  bot('bulma', 'Bulma', 'working', 'dfl'),
  bot('ada', 'Ada', 'working', 'dfl'),
];

export const DEMO_ROLES: Record<string, string> = {
  iris: 'CEO', otto: 'CTO', luffy: 'Tech Lead Itera', zoro: 'Tech Lead DFL', raquel: 'Reviewer', anderson: 'QA', lara: 'Designer',
  lorena: 'Segurança', goku: 'Tech Lead Deck', nami: 'Game dev e pixel art', arthur: 'Head de Growth', mari: 'Conteúdo',
  usopp: 'Animação e 3D', malu: 'Autora de aulas Itera', robin: 'CFO', bulma: 'Receita DFL', ada: 'Operações',
};

export const DEMO_PROJECTS: Record<string, number> = { itera: 4, dfl: 6, 'corte-radar': 1 };

// Who sits in the demo meeting (?meeting=1 or after Convocar in demo).
export const DEMO_MEETING = ['luffy', 'zoro', 'raquel', 'lara'];

export const DEMO_COUNTS: Record<string, number> = { iris: 4, luffy: 2, anderson: 7, arthur: 1, ada: 3, raquel: 2 };

// Pairs the demo cycles through to keep handoff items flying.
const PAIRS: readonly (readonly [string, string])[] = [['iris', 'luffy'], ['anderson', 'ada'], ['arthur', 'raquel'], ['ada', 'iris']];

export function demoTeamState(now: number, tick = 0): TeamState {
  const [from, to] = PAIRS[tick % PAIRS.length]!;
  const doing = demoDoing(tick);
  return {
    at: now,
    followUpHours: 4,
    bots: DEMO_BOTS.map((b) => (doing.has(b.id) ? { ...b, doing: true } : b)),
    handoffs: [{ from, to, point: 'demo', at: now, taskId: `demo-${tick}` }],
    followUps: [],
  };
}

const MERGE_ORDER = ['luffy', 'ada', 'anderson', 'zoro', 'arthur'];

// Merged PR counts: one bot gains a merge every other tick, in turn.
export function demoMergedCounts(tick: number): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(MERGE_ORDER.map((id) => [id, 3]));
  for (let k = 1; k <= Math.floor(tick / 2); k++) out[MERGE_ORDER[k % MERGE_ORDER.length]!]! += 1;
  return out;
}

const DOING_ORDER = ['luffy', 'zoro', 'anderson', 'ada'];
export const DEMO_DOING_CYCLE = 16;

// One working bot at a time claims a task for 8 ticks, then lets it go; the next bot in turn.
export function demoDoing(tick: number): ReadonlySet<string> {
  const phase = tick % DEMO_DOING_CYCLE;
  if (phase < 2 || phase >= 10) return new Set();
  return new Set([DOING_ORDER[Math.floor(tick / DEMO_DOING_CYCLE) % DOING_ORDER.length]!]);
}
