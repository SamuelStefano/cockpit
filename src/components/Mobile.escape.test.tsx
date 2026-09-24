// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('./Sessions', () => ({ SessionsPanel: () => null }));
vi.mock('./Chat', () => ({ ChatPanel: () => null }));
vi.mock('./Terminals', () => ({ TerminalsPanel: () => null }));

import { MobileLayout } from './Mobile';
import { useEscapeLayer } from './primitives/useEscapeLayer';

afterEach(cleanup);

function Dialog({ onClose }: { onClose: () => void }) {
  useEscapeLayer(true, onClose);
  return null;
}

const props = (setDrawer: (v: boolean) => void) => ({
  sessionsProps: {} as never, chatProps: {} as never, termProps: {} as never,
  drawer: true, setDrawer, termSheet: false, setTermSheet: vi.fn(), runningTerm: undefined,
});

describe('MobileLayout Escape', () => {
  it('closes a dialog opened over the sessions drawer before the drawer', () => {
    const setDrawer = vi.fn();
    const closeDialog = vi.fn();
    const { rerender } = render(<MobileLayout {...props(setDrawer)} />);
    rerender(<><MobileLayout {...props(setDrawer)} /><Dialog onClose={closeDialog} /></>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(setDrawer).not.toHaveBeenCalled();
  });

  it('closes the drawer when it is the top overlay', () => {
    const setDrawer = vi.fn();
    render(<MobileLayout {...props(setDrawer)} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(setDrawer).toHaveBeenCalledWith(false);
  });
});
