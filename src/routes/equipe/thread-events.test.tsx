// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { Cron } from '../../../shared/protocol';
import { ThreadEvent, memoryEvent, routineEvent } from '../../components/chat/ThreadEvent';
import { routineEvents } from './thread-events';

afterEach(cleanup);

const cron = (id: string, over: Partial<Cron> = {}): Cron => ({ id, name: 'Rodada de growth', prompt: '', schedule: { kind: 'daily', atMinute: 540 }, enabled: true, createdAt: 0, botId: 'capo1', ...over });

describe('routineEvents', () => {
  const now = Date.UTC(2026, 9, 28, 15);
  it('keeps this bot routines that ran in the last day', () => {
    const out = routineEvents([cron('a', { lastRun: now - 3_600_000 }), cron('b'), cron('c', { lastRun: now - 2 * 86_400_000 }), cron('d', { botId: 'other', lastRun: now - 1000 })], 'capo1', now);
    expect(out.map((e) => e.key)).toEqual([`routine-a-${now - 3_600_000}`]);
  });
});

describe('ThreadEvent', () => {
  it('words a routine run in Brasília time', () => {
    const r = render(<ThreadEvent>{routineEvent('Rodada de growth', Date.UTC(2026, 9, 28, 12))}</ThreadEvent>);
    expect(r.container.textContent).toBe('Rotina Rodada de growth rodou às 09:00');
    expect(r.getByText('Rodada de growth').tagName).toBe('B');
  });
  it('words a memory update', () => {
    const r = render(<ThreadEvent>{memoryEvent('Concorrentes')}</ThreadEvent>);
    expect(r.container.textContent).toBe('Atualizou a memória Concorrentes');
  });
});
