import { describe, expect, it } from 'vitest';
import type { Cron, CronSchedule } from '../../../shared/protocol';
import { upcomingSlots } from './cron-timeline';

const NOW = Date.UTC(2026, 8, 11, 12);
const H = 60 * 60_000;

const cron = (id: string, schedule: CronSchedule, extra: Partial<Cron> = {}): Cron =>
  ({ id, name: id, prompt: 'p', schedule, enabled: true, createdAt: NOW - 48 * H, ...extra }) as Cron;

describe('upcomingSlots', () => {
  it('places a daily cron once inside the window', () => {
    const slots = upcomingSlots([cron('d', { kind: 'daily', atMinute: 21 * 60 })], NOW);
    expect(slots).toHaveLength(1);
    expect(slots[0].at).toBe(Date.UTC(2026, 9 - 1, 12, 0));
  });

  it('repeats interval crons across the window', () => {
    const slots = upcomingSlots([cron('i', { kind: 'interval', everyMinutes: 360 }, { lastRun: NOW - H })], NOW);
    expect(slots.map((s) => (s.at - NOW) / H)).toEqual([5, 11, 17, 23]);
  });

  it('draws an overdue interval at now', () => {
    const slots = upcomingSlots([cron('i', { kind: 'interval', everyMinutes: 60 }, { lastRun: NOW - 3 * H })], NOW);
    expect(slots[0].at).toBe(NOW);
  });

  it('skips paused crons and one-shots already fired or outside the window', () => {
    const slots = upcomingSlots([
      cron('paused', { kind: 'daily', atMinute: 600 }, { enabled: false }),
      cron('fired', { kind: 'once', atMs: NOW + H }, { lastRun: NOW + H }),
      cron('later', { kind: 'once', atMs: NOW + 30 * H }),
      cron('soon', { kind: 'once', atMs: NOW + 2 * H }),
    ], NOW);
    expect(slots.map((s) => s.cronId)).toEqual(['soon']);
  });

  it('marks runs from different crons within 15 minutes as clashing', () => {
    const slots = upcomingSlots([
      cron('a', { kind: 'once', atMs: NOW + H }),
      cron('b', { kind: 'once', atMs: NOW + H + 10 * 60_000 }),
      cron('c', { kind: 'once', atMs: NOW + 5 * H }),
    ], NOW);
    expect(slots.map((s) => s.clash)).toEqual([true, true, false]);
  });
});
