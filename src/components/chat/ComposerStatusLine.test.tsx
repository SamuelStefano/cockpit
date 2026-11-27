// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ComposerStatusLine } from './ComposerStatusLine';

afterEach(cleanup);

describe('ComposerStatusLine', () => {
  it('renders nothing without context or queue', () => {
    const { container } = render(<ComposerStatusLine contextTokens={0} queued={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the context percentage with a tone dot', () => {
    const { container } = render(<ComposerStatusLine contextTokens={20_000} queued={0} />);
    expect(screen.getByText(/% do contexto/)).toBeTruthy();
    expect(container.querySelector('[data-tone="ok"]')).toBeTruthy();
    expect(screen.queryByText(/na fila/)).toBeNull();
  });

  it('shows the queue count and opens the queue on click', () => {
    const onOpenQueue = vi.fn();
    render(<ComposerStatusLine contextTokens={20_000} queued={2} onOpenQueue={onOpenQueue} />);
    fireEvent.click(screen.getByText('2 na fila'));
    expect(onOpenQueue).toHaveBeenCalledOnce();
  });

  it('shows only the queue when there is no context data', () => {
    render(<ComposerStatusLine contextTokens={0} queued={1} />);
    expect(screen.queryByText(/do contexto/)).toBeNull();
    expect(screen.getByText('1 na fila')).toBeTruthy();
  });
});
