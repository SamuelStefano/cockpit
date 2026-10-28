// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { OfflineNotice, backendHost, diagnosticLine } from './OfflineNotice';
import { recordClose, resetTelemetryForTests } from '../../app/connectionTelemetry';

afterEach(() => { cleanup(); resetTelemetryForTests(); });

describe('OfflineNotice', () => {
  it('names the backend host the socket dials, not the page host', () => {
    expect(backendHost('wss://vps.tailnet.ts.net/ws')).toBe('vps.tailnet.ts.net');
    expect(backendHost('ws://127.0.0.1:7777/ws')).toBe('127.0.0.1:7777');
  });

  it('offers "Reconectar agora" when a reconnect is wired', () => {
    const onReconnect = vi.fn();
    const { getByText } = render(<OfflineNotice show onReconnect={onReconnect} />);
    fireEvent.click(getByText('Reconectar agora'));
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it('says the login was refused, not that the backend is down, after a relay 4401', () => {
    const { getByText, queryByText } = render(<OfflineNotice show authRejected />);
    expect(getByText('Login recusado pelo relay')).toBeTruthy();
    expect(queryByText('Backend não acessível')).toBeNull();
  });

  it('formats the diagnostic line', () => {
    expect(diagnosticLine(1006, 1000, 43_000)).toBe('código 1006 · offline há 42 s');
    expect(diagnosticLine(1006, null)).toBe('código 1006');
    expect(diagnosticLine(undefined, 1000)).toBeNull();
  });

  it('shows the diagnostic only when a close code is known', () => {
    const { queryByText, rerender } = render(<OfflineNotice show offlineSince={Date.now() - 42_000} />);
    expect(queryByText(/^código/)).toBeNull();
    recordClose(1006, '');
    rerender(<OfflineNotice show offlineSince={Date.now() - 42_000} />);
    expect(queryByText(/^código 1006 · offline há 4\d s$/)).toBeTruthy();
  });
});
