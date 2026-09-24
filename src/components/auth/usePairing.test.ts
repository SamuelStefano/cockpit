// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../cockpit/session', () => ({ relayHttpBase: () => 'https://relay.test' }));

import { usePairing } from './usePairing';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

describe('usePairing', () => {
  it('keeps the code when the session token refreshes', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: `CODE${++n}`, expiresAt: new Date(Date.now() + 600_000).toISOString() }), { status: 200 }));
    globalThis.fetch = fetchMock as never;
    const { result, rerender } = renderHook(({ t }) => usePairing(t), { initialProps: { t: 'jwt-1' } });
    await waitFor(() => expect(result.current.code).toBe('CODE1'));
    rerender({ t: 'jwt-2' });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.code).toBe('CODE1');
  });

  it('uses the current token when a new code is requested', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 'C' }), { status: 200 }));
    globalThis.fetch = fetchMock as never;
    const { result, rerender } = renderHook(({ t }) => usePairing(t), { initialProps: { t: 'jwt-1' } });
    await waitFor(() => expect(result.current.code).toBe('C'));
    rerender({ t: 'jwt-2' });
    result.current.fetchCode();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const init = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer jwt-2');
  });
});
