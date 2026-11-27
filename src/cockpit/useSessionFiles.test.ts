// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { sessionFileKey, useSessionFiles } from './useSessionFiles';

const b64 = (s: string) => btoa(s);
const K = sessionFileKey('s1', 'a.ts');

describe('useSessionFiles', () => {
  it('asks again on every open and keeps the shown copy until the new one lands', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useSessionFiles(send));
    act(() => result.current.onSessionFileGet('s1', 'a.ts'));
    expect(result.current.sessionFileData[K]).toEqual({ status: 'loading' });
    act(() => result.current.onSessionFileGet('s1', 'a.ts'));
    expect(send).toHaveBeenCalledTimes(1);
    act(() => { result.current.onMsg({ t: 'session-file', sessionId: 's1', path: 'a.ts', mime: 'text/plain', size: 2, dataB64: b64('v1') }); });
    act(() => result.current.onSessionFileGet('s1', 'a.ts'));
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.current.sessionFileData[K]).toMatchObject({ status: 'ok', text: 'v1' });
    act(() => { result.current.onMsg({ t: 'session-file', sessionId: 's1', path: 'a.ts', mime: 'text/plain', size: 2, dataB64: b64('v2') }); });
    expect(result.current.sessionFileData[K]).toMatchObject({ status: 'ok', text: 'v2' });
  });

  it('retries a request that never answered, and an error', () => {
    let t = 0;
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useSessionFiles(send, () => t));
    act(() => result.current.onSessionFileGet('s1', 'a.ts'));
    t = 11_000;
    act(() => result.current.onSessionFileGet('s1', 'a.ts'));
    expect(send).toHaveBeenCalledTimes(2);
    act(() => { result.current.onMsg({ t: 'session-file', sessionId: 's1', path: 'a.ts', error: 'arquivo não encontrado' }); });
    expect(result.current.sessionFileData[K]).toEqual({ status: 'error', error: 'arquivo não encontrado' });
    act(() => result.current.onSessionFileGet('s1', 'a.ts'));
    expect(send).toHaveBeenCalledTimes(3);
    expect(result.current.sessionFileData[K]).toEqual({ status: 'loading' });
  });

  it('accepts an empty file and carries the truncated flag', () => {
    const { result } = renderHook(() => useSessionFiles(() => true));
    act(() => { result.current.onMsg({ t: 'session-file', sessionId: 's1', path: 'a.ts', mime: 'text/plain', size: 0, dataB64: '' }); });
    expect(result.current.sessionFileData[K]).toMatchObject({ status: 'ok', text: '' });
    act(() => { result.current.onMsg({ t: 'session-file', sessionId: 's1', path: 'a.ts', mime: 'text/plain', size: 9, dataB64: b64('x'), truncated: true }); });
    expect(result.current.sessionFileData[K]).toMatchObject({ truncated: true });
  });

  it('does not mark loading when the socket refused the frame', () => {
    const { result } = renderHook(() => useSessionFiles(() => false));
    act(() => result.current.onSessionFileGet('s1', 'a.ts'));
    expect(result.current.sessionFileData[K]).toBeUndefined();
  });
});
