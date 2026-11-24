import { describe, it, expect } from 'vitest';
import type { Cron } from './protocol';
import { botRoutineError, routinesOf, MIN_BOT_ROUTINE_MINUTES } from './bot-routine';

const bots = [{ id: 'capo1' }];
const every = (m: number) => ({ kind: 'interval' as const, everyMinutes: m });

describe('botRoutineError', () => {
  it('lets a plain cron through untouched', () => {
    expect(botRoutineError({ schedule: every(1) }, [])).toBeNull();
  });

  it('rejects a bot that does not exist', () => {
    expect(botRoutineError({ botId: 'ghost1', schedule: every(10) }, bots)).toBe('bot não encontrado');
  });

  it('rejects a malformed bot id', () => {
    expect(botRoutineError({ botId: '../x', schedule: every(10) }, bots)).toBe('bot inválido');
  });

  it('enforces the minimum interval only on interval schedules', () => {
    expect(botRoutineError({ botId: 'capo1', schedule: every(MIN_BOT_ROUTINE_MINUTES - 1) }, bots)).toMatch(/mínimo/);
    expect(botRoutineError({ botId: 'capo1', schedule: every(MIN_BOT_ROUTINE_MINUTES) }, bots)).toBeNull();
    expect(botRoutineError({ botId: 'capo1', schedule: { kind: 'daily', atMinute: 0 } }, bots)).toBeNull();
  });
});

describe('routinesOf', () => {
  it('keeps only the crons of that bot', () => {
    const c = (id: string, botId?: string) => ({ id, botId } as Cron);
    expect(routinesOf([c('a', 'capo1'), c('b'), c('c', 'other1')], 'capo1').map((x) => x.id)).toEqual(['a']);
  });
});
