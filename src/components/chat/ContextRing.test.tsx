// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ContextRing } from './ContextRing';

afterEach(cleanup);

describe('ContextRing', () => {
  it('renders nothing without context', () => {
    const { container } = render(<ContextRing tokens={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('describes the fill as percent and k tokens, with no new-session button below the limit', () => {
    render(<ContextRing tokens={76_000} model="claude-opus-4-8" onNew={vi.fn()} />);
    expect(screen.getByRole('meter').getAttribute('aria-label')).toMatch(/^Contexto \d+% · 76k$/);
    expect(screen.queryByText('nova sessão')).toBeNull();
  });

  it('shows the new-session action when over the limit', () => {
    const onNew = vi.fn();
    render(<ContextRing tokens={900_000} model="claude-opus-4-8" onNew={onNew} />);
    fireEvent.click(screen.getByText('nova sessão'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
