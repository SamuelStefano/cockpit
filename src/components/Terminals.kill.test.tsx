// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('./Xterm', () => ({ XtermView: () => null }));

import { TerminalsPanel } from './Terminals';

afterEach(cleanup);

describe('TerminalsPanel close on a single tab', () => {
  it('needs a second tap before killing the tmux session', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <TerminalsPanel terminals={[{ id: 't1', name: 'shell' } as never]} activeId="t1" onSelect={vi.fn()} onAdd={vi.fn()} onClose={onClose} term={{ exited: new Set<string>() } as never} />,
    );
    fireEvent.click(getByLabelText('Fechar terminal'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(getByLabelText('Confirmar: fechar terminal'));
    expect(onClose).toHaveBeenCalledWith('t1');
  });
});

describe('TerminalsPanel tab ✕', () => {
  it('also needs a second tap (it ends the same tmux session)', () => {
    const onClose = vi.fn();
    const { getAllByLabelText } = render(
      <TerminalsPanel terminals={[{ id: 't1', name: 'a' } as never, { id: 't2', name: 'b' } as never]} activeId="t1" onSelect={vi.fn()} onAdd={vi.fn()} onClose={onClose} term={{ exited: new Set<string>() } as never} />,
    );
    const x = getAllByLabelText('Fechar terminal')[0];
    fireEvent.click(x);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(getAllByLabelText('Confirmar: fechar terminal')[0]);
    expect(onClose).toHaveBeenCalledWith('t1');
  });
});
