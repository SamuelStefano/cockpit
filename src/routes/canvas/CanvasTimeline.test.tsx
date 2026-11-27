// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CanvasTimeline } from './CanvasTimeline';

afterEach(cleanup);

const tl = (live: boolean) => ({
  live, playing: false, t: 1000, rangeStart: 0, rangeEnd: 1000,
  setT: vi.fn(), play: vi.fn(), pause: vi.fn(), goLive: vi.fn(),
});

describe('CanvasTimeline play label', () => {
  it('says it replays the whole window when live, and "from here" when scrubbed', () => {
    const { getByRole, rerender } = render(<CanvasTimeline timeline={tl(true)} />);
    expect(getByRole('button', { name: 'reproduzir os últimos 7 dias' })).toBeTruthy();
    rerender(<CanvasTimeline timeline={tl(false)} />);
    expect(getByRole('button', { name: 'reproduzir a partir daqui' })).toBeTruthy();
  });
});
