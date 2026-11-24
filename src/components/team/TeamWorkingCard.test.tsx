// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, renderHook, act } from '@testing-library/react';
import type { BotView } from '../../routes/equipe/team-view';
import { TeamWorkingCard } from './TeamWorkingCard';
import { useTeamPresence } from './useTeamPresence';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const v = (name: string, state: BotView['state'], over: Partial<BotView> = {}): BotView => ({
  bot: { id: name, name, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0 },
  key: name, preview: '', unread: false, state, ...over,
});

describe('TeamWorkingCard', () => {
  it('shows one row per agent with the mascot in its state', () => {
    const r = render(<TeamWorkingCard rows={[v('Growth', 'thinking', { startedAt: Date.now() - 120_000 }), v('Redator', 'idle'), v('Revisor', 'done', { endedAt: Date.now() })]} />);
    expect(r.getByLabelText('Equipe trabalhando')).toBeTruthy();
    expect(r.getByRole('img', { name: 'Growth: pensando' })).toBeTruthy();
    expect(r.getByText('Livre')).toBeTruthy();
    expect(r.getByText('Concluiu')).toBeTruthy();
    expect(r.getByText('há 2 min')).toBeTruthy();
  });
  it('fades out when leaving', () => {
    const r = render(<TeamWorkingCard rows={[v('A', 'done')]} leaving />);
    expect(r.getByLabelText('Equipe trabalhando').className).toContain('opacity-0');
  });
});

describe('useTeamPresence', () => {
  it('holds 1.5 s after the last one finishes, fades, then unmounts', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ a }) => useTeamPresence(a), { initialProps: { a: true } });
    expect(result.current).toBe('shown');
    rerender({ a: false });
    act(() => { vi.advanceTimersByTime(1_499); });
    expect(result.current).toBe('shown');
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current).toBe('leaving');
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('hidden');
  });
});
