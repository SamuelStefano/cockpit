// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { LivingPhrase, PHRASE_LINGER_MS } from './LivingPhrase';

afterEach(() => { vi.useRealTimers(); });

describe('LivingPhrase', () => {
  it('cross-fades to the next phrase every 4s', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { container } = render(<LivingPhrase active startedAt={10_000} />);
    expect(screen.getByText('Pensando…')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(screen.getByText('Ponderando…')).toBeTruthy();
    expect(container.querySelector('.living-phrase-out')?.textContent).toBe('Pensando…');
    act(() => { vi.advanceTimersByTime(300); });
    expect(container.querySelector('.living-phrase-out')).toBeNull();
  });

  it('goes away 1.5s after the turn ends', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<LivingPhrase active />);
    rerender(<LivingPhrase active={false} />);
    expect(container.textContent).toBe('Pensando…');
    act(() => { vi.advanceTimersByTime(PHRASE_LINGER_MS); });
    expect(container.textContent).toBe('');
  });

  it('announces politely only when asked to be live', () => {
    const { container, rerender } = render(<LivingPhrase active />);
    expect(container.querySelector('[role="status"]')).toBeNull();
    rerender(<LivingPhrase active live />);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });
});
