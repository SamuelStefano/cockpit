// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ContextRing } from './ContextRing';

afterEach(cleanup);

describe('ContextRing', () => {
  it('stays rendered and dimmed without context', () => {
    render(<ContextRing tokens={0} onNew={vi.fn()} />);
    expect(screen.getByLabelText('Contexto da conversa: 0%')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Recomeçar com contexto limpo' })).toBeNull();
  });

  it('stays rendered below 70 percent', () => {
    render(<ContextRing tokens={76_000} model="claude-opus-4-8" onNew={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Recomeçar com contexto limpo' })).toBeNull();
  });

  it('shows the new-session action when over the limit', () => {
    const onNew = vi.fn();
    render(<ContextRing tokens={900_000} model="claude-opus-4-8" onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar com contexto limpo' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
