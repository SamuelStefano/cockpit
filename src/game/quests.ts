import type { EventCtx } from './types';

export interface QuestDef {
  id: string;
  title: string;
  goal: number;
  xp: number;
  // How much one event moves this quest (0 = not related).
  step: (ctx: EventCtx) => number;
}

const on = (type: string) => ({ event }: EventCtx) => (event.type === type ? 1 : 0);
const turnWhen = (pred: (c: EventCtx) => boolean) => (c: EventCtx) => (c.event.type === 'turn_done' && pred(c) ? 1 : 0);

export const QUESTS: QuestDef[] = [
  { id: 'turns-3', title: 'Termine 3 turnos', goal: 3, xp: 30, step: on('turn_done') },
  { id: 'turns-5', title: 'Termine 5 turnos', goal: 5, xp: 45, step: on('turn_done') },
  { id: 'turns-8', title: 'Termine 8 turnos', goal: 8, xp: 70, step: on('turn_done') },
  { id: 'send-5', title: 'Envie 5 mensagens', goal: 5, xp: 25, step: on('message_sent') },
  { id: 'new-2', title: 'Abra 2 conversas novas', goal: 2, xp: 25, step: on('session_new') },
  { id: 'visit-4', title: 'Passe por 4 telas', goal: 4, xp: 20, step: on('route_visit') },
  { id: 'palette-1', title: 'Abra a paleta de comandos', goal: 1, xp: 15, step: on('palette_open') },
  { id: 'palette-3', title: 'Use a paleta 3 vezes', goal: 3, xp: 25, step: on('palette_open') },
  { id: 'fish-3', title: 'Pesque 3 coisas com o Bit', goal: 3, xp: 25, step: on('fish_caught') },
  { id: 'early-10', title: 'Termine um turno antes das 10h', goal: 1, xp: 30, step: turnWhen(({ now }) => now.getHours() < 10) },
  { id: 'late-18', title: 'Termine um turno depois das 18h', goal: 1, xp: 30, step: turnWhen(({ now }) => now.getHours() >= 18) },
  { id: 'parallel-2', title: 'Deixe 2 turnos rodando juntos', goal: 1, xp: 35, step: turnWhen(({ event }) => (event.concurrent ?? 0) >= 2) },
];

export const QUEST_BONUS_XP = 60;
export const DAILY_QUEST_COUNT = 3;

export const questById = (id: string): QuestDef | undefined => QUESTS.find((q) => q.id === id);

function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "turns-5" and "turns-8" on the same day would be one quest paid twice.
const family = (q: QuestDef): string => q.id.split('-')[0];

// Seeded by the local day string so every call (and every tab) agrees on the same 3.
export function questsForDay(day: string): QuestDef[] {
  const rnd = mulberry32(hashSeed(`deck-arcade:${day}`));
  const pool = [...QUESTS];
  const out: QuestDef[] = [];
  while (out.length < DAILY_QUEST_COUNT && pool.length) {
    const pick = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if (!out.some((q) => family(q) === family(pick))) out.push(pick);
  }
  return out;
}
