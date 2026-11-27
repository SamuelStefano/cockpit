import type { ReactNode } from 'react';
import type { Cron } from '../../../shared/protocol';
import { routineEvent } from '../../components/chat/ThreadEvent';

export const EVENT_WINDOW_MS = 24 * 60 * 60_000;

// One line per routine of the bot that ran in the last day: the log keeps only
// the latest run, so older ones are not rebuilt.
export function routineEvents(crons: Cron[], botId: string, now = Date.now()): { key: string; ts: number; node: ReactNode }[] {
  return crons
    .filter((c) => c.botId === botId && c.lastRun !== undefined && now - c.lastRun < EVENT_WINDOW_MS)
    .map((c) => ({ key: `routine-${c.id}-${c.lastRun}`, ts: c.lastRun as number, node: routineEvent(c.name, c.lastRun as number) }));
}
