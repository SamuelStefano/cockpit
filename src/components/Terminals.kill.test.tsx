// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('./Xterm', () => ({ XtermView: () => null }));

import { TerminalsPanel } from './Terminals';

afterEach(cleanup);

describe('TerminalsPanel "matar"', () => {
  it('needs a second tap before killing the tmux session', () => {
    const onClose = vi.fn();
    const { getByTitle } = render(
      <TerminalsPanel terminals={[{ id: 't1', name: 'shell' } as never]} activeId="t1" onSelect={vi.fn()} onAdd={vi.fn()} onClose={onClose} term={{} as never} />,
    );
    fireEvent.click(getByTitle('Encerra a sessão tmux'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(getByTitle('Encerra a sessão tmux'));
    expect(onClose).toHaveBeenCalledWith('t1');
  });
});
