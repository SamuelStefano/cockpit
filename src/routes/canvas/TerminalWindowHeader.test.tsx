// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import type { CanvasNode } from '../../../shared/canvas';
import { TerminalWindowHeader } from './TerminalWindowHeader';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const node = { id: 'n1', title: 'worker', ref: 'r1' } as unknown as CanvasNode;
const noop = () => {};
const base = {
  node, session: true, orchestrator: false, running: true, waiting: false, resuming: false, alert: null as never, pct: null,
  onPointerDown: noop, onMaximize: noop, onCollapse: noop, onResume: noop, onOpenChat: noop,
};

describe('TerminalWindowHeader kill', () => {
  it('needs two taps: the first only arms', () => {
    const onKill = vi.fn();
    const { getByLabelText } = render(<TerminalWindowHeader {...base} onKill={onKill} />);
    fireEvent.click(getByLabelText('matar a sessão tmux'));
    expect(onKill).not.toHaveBeenCalled();
    fireEvent.click(getByLabelText('confirmar: matar a sessão tmux'));
    expect(onKill).toHaveBeenCalledWith(node);
  });

  it('disarms by itself after 3s', () => {
    vi.useFakeTimers();
    const onKill = vi.fn();
    const { getByLabelText } = render(<TerminalWindowHeader {...base} onKill={onKill} />);
    fireEvent.click(getByLabelText('matar a sessão tmux'));
    act(() => { vi.advanceTimersByTime(3100); });
    fireEvent.click(getByLabelText('matar a sessão tmux'));
    expect(onKill).not.toHaveBeenCalled();
  });
});
