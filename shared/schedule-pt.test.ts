import { describe, it, expect } from 'vitest';
import { parseCronExpr, parseScheduleText, scheduleToText, scheduleSummary, nextRuns } from './schedule-pt';

const brt = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h + 3, mi);
const NOW = brt(2026, 10, 28, 12, 0);

function ok(text: string, now = NOW) {
  const r = parseScheduleText(text, now);
  if (!r.ok) throw new Error(`expected ok for "${text}", got: ${r.error}`);
  return r;
}
const err = (text: string, now = NOW) => {
  const r = parseScheduleText(text, now);
  if (r.ok) throw new Error(`expected error for "${text}"`);
  return r.error;
};

describe('daily schedules', () => {
  it('todo dia útil às 9h', () => {
    const r = ok('todo dia útil às 9h');
    expect(r.schedule).toEqual({ kind: 'daily', atMinute: 540, weekdays: [1, 2, 3, 4, 5] });
    expect(r.cron).toBe('0 9 * * 1-5');
    expect(r.summary).toBe('dias úteis, 09:00');
  });
  it('dias úteis às 18h30', () => {
    expect(ok('dias úteis às 18h30').schedule).toMatchObject({ atMinute: 1110, weekdays: [1, 2, 3, 4, 5] });
  });
  it('todo dia às 9h has no weekday filter', () => {
    const r = ok('todo dia às 9h');
    expect(r.schedule).toEqual({ kind: 'daily', atMinute: 540 });
    expect(r.cron).toBe('0 9 * * *');
    expect(r.summary).toBe('todo dia, 09:00');
  });
  it('todos os dias às 7:15', () => {
    expect(ok('todos os dias às 7:15').schedule).toEqual({ kind: 'daily', atMinute: 435 });
  });
  it('diariamente às 22h', () => {
    expect(ok('diariamente às 22h').schedule).toEqual({ kind: 'daily', atMinute: 1320 });
  });
  it('todo dia 9h (no "às") is every day, not day-of-month 9', () => {
    expect(ok('todo dia 9h').schedule).toEqual({ kind: 'daily', atMinute: 540 });
  });
  it('de segunda a sexta às 8h', () => {
    expect(ok('de segunda a sexta às 8h').schedule).toMatchObject({ weekdays: [1, 2, 3, 4, 5], atMinute: 480 });
  });
  it('fins de semana às 10h', () => {
    const r = ok('fins de semana às 10h');
    expect(r.schedule).toMatchObject({ weekdays: [0, 6] });
    expect(r.cron).toBe('0 10 * * 0,6');
    expect(r.summary).toBe('fins de semana, 10:00');
  });
  it('sexta a segunda wraps around the week', () => {
    expect(ok('de sexta a segunda às 10h').schedule).toMatchObject({ weekdays: [0, 1, 5, 6] });
  });
});

describe('weekly schedules', () => {
  it('toda segunda às 14h30', () => {
    const r = ok('toda segunda às 14h30');
    expect(r.schedule).toEqual({ kind: 'daily', atMinute: 870, weekdays: [1] });
    expect(r.cron).toBe('30 14 * * 1');
    expect(r.summary).toBe('segundas, 14:30');
  });
  it('toda sexta às 17h', () => {
    expect(ok('toda sexta às 17h').cron).toBe('0 17 * * 5');
  });
  it('accent-insensitive and -feira suffix: toda terça-feira às 9h', () => {
    expect(ok('toda terça-feira às 9h').schedule).toMatchObject({ weekdays: [2] });
    expect(ok('toda terca feira as 9h').schedule).toMatchObject({ weekdays: [2] });
  });
  it('sábado and domingo', () => {
    expect(ok('todo sábado às 11h').schedule).toMatchObject({ weekdays: [6] });
    expect(ok('todo domingo às 20h').cron).toBe('0 20 * * 0');
  });
  it('segunda e quarta list', () => {
    const r = ok('toda segunda e quarta às 14h');
    expect(r.schedule).toMatchObject({ weekdays: [1, 3] });
    expect(r.summary).toBe('segundas e quartas, 14:00');
  });
  it('three weekdays with commas', () => {
    const r = ok('segundas, quartas e sextas às 7h');
    expect(r.schedule).toMatchObject({ weekdays: [1, 3, 5] });
    expect(r.cron).toBe('0 7 * * 1,3,5');
    expect(r.summary).toBe('segundas, quartas e sextas, 07:00');
  });
  it('plural form às segundas', () => {
    expect(ok('às segundas às 8h').schedule).toMatchObject({ weekdays: [1], atMinute: 480 });
  });
  it('is case-insensitive', () => {
    expect(ok('TODA SEGUNDA ÀS 8H').schedule).toMatchObject({ weekdays: [1], atMinute: 480 });
  });
});

describe('monthly schedules', () => {
  it('todo dia 1 às 8h', () => {
    const r = ok('todo dia 1 às 8h');
    expect(r.schedule).toEqual({ kind: 'daily', atMinute: 480, monthDay: 1 });
    expect(r.cron).toBe('0 8 1 * *');
    expect(r.summary).toBe('todo dia 1, 08:00');
  });
  it('todo dia 15 às 10h30', () => {
    expect(ok('todo dia 15 às 10h30').cron).toBe('30 10 15 * *');
  });
  it('dia 5 de cada mês às 9h', () => {
    expect(ok('dia 5 de cada mês às 9h').schedule).toMatchObject({ monthDay: 5 });
  });
  it('rejects day 32 and day 0', () => {
    expect(err('todo dia 32 às 8h')).toMatch(/dia/i);
    expect(err('todo dia 0 às 8h')).toMatch(/dia/i);
  });
  it('rejects mixing weekday and day of month', () => {
    expect(err('toda segunda dia 5 às 8h')).toMatch(/Não entendi/);
  });
});

describe('intervals', () => {
  it('a cada 2 horas', () => {
    const r = ok('a cada 2 horas');
    expect(r.schedule).toEqual({ kind: 'interval', everyMinutes: 120 });
    expect(r.cron).toBe('0 */2 * * *');
    expect(r.summary).toBe('a cada 2 horas');
  });
  it('a cada 30 minutos', () => {
    const r = ok('a cada 30 minutos');
    expect(r.schedule).toEqual({ kind: 'interval', everyMinutes: 30 });
    expect(r.cron).toBe('*/30 * * * *');
  });
  it('a cada 15 min', () => {
    expect(ok('a cada 15 min').schedule).toEqual({ kind: 'interval', everyMinutes: 15 });
  });
  it('a cada 1h and a cada hora', () => {
    expect(ok('a cada 1h').schedule).toEqual({ kind: 'interval', everyMinutes: 60 });
    expect(ok('a cada hora').schedule).toEqual({ kind: 'interval', everyMinutes: 60 });
    expect(ok('de hora em hora').schedule).toEqual({ kind: 'interval', everyMinutes: 60 });
  });
  it('a cada meia hora', () => {
    expect(ok('a cada meia hora').schedule).toEqual({ kind: 'interval', everyMinutes: 30 });
  });
  it('a cada 90 minutos has no plain cron form', () => {
    const r = ok('a cada 90 minutos');
    expect(r.schedule).toEqual({ kind: 'interval', everyMinutes: 90 });
    expect(r.cron).toBeNull();
  });
  it('minimum is 5 minutes', () => {
    expect(err('a cada 3 minutos')).toMatch(/5 min/);
    expect(ok('a cada 5 minutos').schedule).toEqual({ kind: 'interval', everyMinutes: 5 });
  });
  it('a cada 0 horas is invalid', () => {
    expect(err('a cada 0 horas')).toMatch(/Não entendi|mínimo/);
  });
  it('interval plus a clock time is not understood', () => {
    expect(err('a cada 2 horas às 9h')).toMatch(/Não entendi/);
  });
});

describe('time formats', () => {
  it('meio-dia', () => {
    expect(ok('todo dia ao meio-dia').schedule).toMatchObject({ atMinute: 720 });
    expect(ok('todo dia às 12h').schedule).toMatchObject({ atMinute: 720 });
  });
  it('meia-noite', () => {
    expect(ok('todo dia à meia-noite').schedule).toMatchObject({ atMinute: 0 });
  });
  it('9 da manhã, 3 da tarde, 8 da noite', () => {
    expect(ok('todo dia às 9 da manhã').schedule).toMatchObject({ atMinute: 540 });
    expect(ok('todo dia às 3 da tarde').schedule).toMatchObject({ atMinute: 900 });
    expect(ok('todo dia às 8 da noite').schedule).toMatchObject({ atMinute: 1200 });
  });
  it('9 horas and 9 e meia', () => {
    expect(ok('todo dia às 9 horas').schedule).toMatchObject({ atMinute: 540 });
    expect(ok('todo dia às 9 e meia').schedule).toMatchObject({ atMinute: 570 });
  });
  it('9h05 and 09:05', () => {
    expect(ok('todo dia às 9h05').schedule).toMatchObject({ atMinute: 545 });
    expect(ok('todo dia às 09:05').schedule).toMatchObject({ atMinute: 545 });
  });
  it('rejects 25h and 9:75', () => {
    expect(err('todo dia às 25h')).toMatch(/hora/i);
    expect(err('todo dia às 9:75')).toMatch(/hora/i);
  });
  it('time may come before the days', () => {
    expect(ok('às 17h toda sexta').schedule).toMatchObject({ atMinute: 1020, weekdays: [5] });
  });
});

describe('one-off schedules', () => {
  it('amanhã às 9h', () => {
    const r = ok('amanhã às 9h');
    expect(r.schedule).toEqual({ kind: 'once', atMs: brt(2026, 10, 29, 9) });
    expect(r.cron).toBe('0 9 29 10 *');
  });
  it('hoje às 18h30', () => {
    expect(ok('hoje às 18h30').schedule).toEqual({ kind: 'once', atMs: brt(2026, 10, 28, 18, 30) });
  });
  it('hoje at a time already past is refused', () => {
    expect(err('hoje às 8h')).toMatch(/passou/);
  });
  it('em 45 minutos and em 2 horas', () => {
    expect(ok('em 45 minutos').schedule).toEqual({ kind: 'once', atMs: NOW + 45 * 60_000 });
    expect(ok('em 2 horas').schedule).toEqual({ kind: 'once', atMs: NOW + 120 * 60_000 });
  });
  it('amanhã without a time asks for the time', () => {
    expect(err('amanhã')).toMatch(/hora/i);
  });
});

describe('unparseable input', () => {
  it('empty text', () => {
    expect(err('')).toMatch(/toda sexta às 17h/);
    expect(err('   ')).toMatch(/toda sexta às 17h/);
  });
  it('gibberish uses the spec message', () => {
    expect(err('quando der vontade')).toBe("Não entendi — tente 'toda sexta às 17h'");
  });
  it('a bare time without days asks for the days', () => {
    expect(err('às 9h')).toMatch(/Não entendi/);
  });
  it('days without a time asks for the time', () => {
    expect(err('toda segunda')).toMatch(/hora/i);
    expect(err('todo dia')).toMatch(/hora/i);
  });
});

describe('round trip and words', () => {
  const samples = [
    'todo dia útil às 9h', 'toda segunda às 14h30', 'a cada 2 horas', 'todo dia 1 às 8h', 'todo dia às 9h',
    'fins de semana às 10h', 'toda segunda e quarta às 14h', 'a cada 45 minutos',
  ];
  it.each(samples)('scheduleToText(%s) parses back to the same schedule', (text) => {
    const a = ok(text);
    const b = ok(scheduleToText(a.schedule));
    expect(b.schedule).toEqual(a.schedule);
  });
  it('scheduleToText wording', () => {
    expect(scheduleToText(ok('todo dia útil às 9h').schedule)).toBe('todo dia útil às 9h');
    expect(scheduleToText(ok('toda segunda às 14h30').schedule)).toBe('toda segunda às 14h30');
    expect(scheduleToText(ok('a cada 2 horas').schedule)).toBe('a cada 2 horas');
    expect(scheduleToText(ok('todo dia 1 às 8h').schedule)).toBe('todo dia 1 às 8h');
  });
  it('scheduleSummary matches parse summary', () => {
    const r = ok('toda segunda às 8h');
    expect(scheduleSummary(r.schedule)).toBe(r.summary);
  });
});

describe('nextRuns', () => {
  it('weekly: next three Mondays at 08:00 BRT', () => {
    const r = ok('toda segunda às 8h');
    expect(nextRuns(r.schedule, NOW, 3)).toEqual([brt(2026, 11, 2, 8), brt(2026, 11, 9, 8), brt(2026, 11, 16, 8)]);
  });
  it('weekdays skip the weekend', () => {
    const r = ok('dias úteis às 9h');
    const fri = brt(2026, 10, 30, 12);
    expect(nextRuns(r.schedule, fri, 3)).toEqual([brt(2026, 11, 2, 9), brt(2026, 11, 3, 9), brt(2026, 11, 4, 9)]);
  });
  it('daily today if the slot is still ahead', () => {
    const r = ok('todo dia às 18h');
    expect(nextRuns(r.schedule, NOW, 2)).toEqual([brt(2026, 10, 28, 18), brt(2026, 10, 29, 18)]);
  });
  it('monthly skips months without the day', () => {
    const r = ok('todo dia 31 às 8h');
    expect(nextRuns(r.schedule, brt(2026, 11, 1, 0), 2)).toEqual([brt(2026, 12, 31, 8), brt(2027, 1, 31, 8)]);
  });
  it('interval steps from now', () => {
    const r = ok('a cada 2 horas');
    expect(nextRuns(r.schedule, NOW, 3)).toEqual([NOW + 7_200_000, NOW + 14_400_000, NOW + 21_600_000]);
  });
  it('once returns the single future instant, or nothing once past', () => {
    const r = ok('amanhã às 9h');
    expect(nextRuns(r.schedule, NOW, 3)).toEqual([brt(2026, 10, 29, 9)]);
    expect(nextRuns(r.schedule, brt(2026, 10, 30, 0), 3)).toEqual([]);
  });
});

describe('raw cron fallback', () => {
  it('weekday cron', () => {
    const r = ok('0 9 * * 1-5');
    expect(r.schedule).toEqual({ kind: 'daily', atMinute: 540, weekdays: [1, 2, 3, 4, 5] });
    expect(r.summary).toBe('dias úteis, 09:00');
  });
  it('month-day cron', () => {
    expect(ok('0 8 1 * *').schedule).toEqual({ kind: 'daily', atMinute: 480, monthDay: 1 });
  });
  it('step crons become intervals', () => {
    expect(ok('*/15 * * * *').schedule).toEqual({ kind: 'interval', everyMinutes: 15 });
    expect(ok('0 */2 * * *').schedule).toEqual({ kind: 'interval', everyMinutes: 120 });
    expect(ok('0 * * * *').schedule).toEqual({ kind: 'interval', everyMinutes: 60 });
  });
  it('sunday as 7 and lists', () => {
    expect(ok('30 14 * * 7').schedule).toMatchObject({ weekdays: [0] });
    expect(ok('0 7 * * 1,3,5').schedule).toMatchObject({ weekdays: [1, 3, 5] });
  });
  it('every day cron has no filter', () => {
    expect(ok('15 7 * * *').schedule).toEqual({ kind: 'daily', atMinute: 435 });
  });
  it('rejects what a routine cannot hold', () => {
    expect(parseCronExpr('0 9 1 * 1').ok).toBe(false);
    expect(parseCronExpr('0 9 * 3 *').ok).toBe(false);
    expect(parseCronExpr('0 9 * *').ok).toBe(false);
    expect(parseCronExpr('*/2 * * * *').ok).toBe(false);
  });
  it('parse(cronOf(schedule)) is the identity', () => {
    for (const text of ['toda segunda às 14h30', 'todo dia útil às 9h', 'a cada 2 horas', 'a cada 30 minutos', 'todo dia 15 às 10h', 'fins de semana às 10h']) {
      const a = ok(text);
      expect(ok(a.cron as string).schedule).toEqual(a.schedule);
    }
  });
});
