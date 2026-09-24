// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { QueuedBanner } from './QueuedBanner';

afterEach(cleanup);

const props = (queued: string[]) => ({
  queued,
  queuedModels: queued.map(() => 'claude-sonnet-5'),
  models: [],
  onRunBg: vi.fn(),
  onRunNow: vi.fn(),
  onCancelQueueAt: vi.fn(),
  onEdit: vi.fn(),
  onMove: vi.fn(),
});

describe('QueuedBanner', () => {
  it('caps the list height so a long queue scrolls instead of eating the thread', () => {
    render(<QueuedBanner {...props(['a', 'b', 'c'])} />);
    const list = screen.getByRole('list');
    expect(list.className).toMatch(/\bmax-h-48\b/);
    expect(list.className).toMatch(/\boverflow-y-auto\b/);
  });

  it('scrolls a moved item into view inside the capped list', () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(<QueuedBanner {...props(['a', 'b', 'c'])} />);
    fireEvent.click(screen.getAllByTitle('Descer na fila')[0]);
    expect(spy).toHaveBeenCalledWith({ block: 'nearest' });
  });
});
