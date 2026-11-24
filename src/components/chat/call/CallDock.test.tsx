// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CallDock } from './CallDock';
import { initialCallState } from './call-machine';
import type { useCall } from './useCall';

afterEach(cleanup);

type Call = ReturnType<typeof useCall>;

function makeCall(over: Partial<Call> = {}): Call {
  return {
    supported: true, state: initialCallState, heard: '', error: null,
    dial: vi.fn(), hangup: vi.fn(), toggleMute: vi.fn(), interrupt: vi.fn(), dismissError: vi.fn(),
    ...over,
  };
}

describe('CallDock', () => {
  it('renders nothing while no call is active', () => {
    const { container } = render(<CallDock call={makeCall()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the dial error without any Ligar bar', () => {
    render(<CallDock call={makeCall({ error: 'Microfone bloqueado' })} />);
    expect(screen.getByText('Microfone bloqueado')).not.toBeNull();
    expect(screen.queryByText('Ligar')).toBeNull();
  });

  it('shows the call region with hangup while active', () => {
    const hangup = vi.fn();
    render(<CallDock call={makeCall({ state: { ...initialCallState, phase: 'listening' }, hangup })} />);
    expect(screen.getByRole('region', { name: 'Chamada de voz' })).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Desligar'));
    expect(hangup).toHaveBeenCalledTimes(1);
  });
});
