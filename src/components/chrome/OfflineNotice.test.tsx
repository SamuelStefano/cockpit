// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { OfflineNotice, backendHost } from './OfflineNotice';

afterEach(cleanup);

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
});
