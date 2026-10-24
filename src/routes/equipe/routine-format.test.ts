import { describe, it, expect } from 'vitest';
import type { Cron } from '../../../shared/protocol';
import { routineScheduleLabel, routineStatusLabel } from './routine-format';

describe('routine labels', () => {
  it('reads the schedule the way the Detalhes panel shows it', () => {
    expect(routineScheduleLabel({ kind: 'interval', everyMinutes: 5 })).toBe('a cada 5 min');
    expect(routineScheduleLabel({ kind: 'interval', everyMinutes: 120 })).toBe('a cada 2 h');
    expect(routineScheduleLabel({ kind: 'daily', atMinute: 7 * 60 + 5 })).toBe('todo dia às 07:05');
  });

  it('shows the next fire only while active', () => {
    const c: Cron = { id: 'r', name: 'n', prompt: 'p', schedule: { kind: 'interval', everyMinutes: 10 }, enabled: true, createdAt: 0, lastRun: 0 };
    expect(routineStatusLabel(c, 0)).toBe('próxima em 10min');
    expect(routineStatusLabel({ ...c, enabled: false }, 0)).toBe('pausada');
    expect(routineStatusLabel(c, 0, true)).toBe('bot removido');
  });
});
