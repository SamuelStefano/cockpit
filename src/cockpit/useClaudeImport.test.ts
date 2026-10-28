// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClaudeImport } from './useClaudeImport';

const scan = { source: '/x/.claude', found: true, skills: [], mcps: [], memory: [] };

describe('useClaudeImport', () => {
  it('sends scan/apply frames and stores the answer', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useClaudeImport(send));
    act(() => result.current.onScan(' /x/.claude '));
    expect(send).toHaveBeenCalledWith({ t: 'claude-import-scan', path: '/x/.claude' });
    expect(result.current.busy).toBe(true);
    act(() => { result.current.onMsg({ t: 'claude-import', scan, hint: 'sudo cp' }); });
    expect(result.current.busy).toBe(false);
    expect(result.current.hint).toBe('sudo cp');
    act(() => result.current.onApply(['skills']));
    expect(send).toHaveBeenLastCalledWith({ t: 'claude-import-apply', kinds: ['skills'], path: undefined });
  });

  it('stays idle when the socket is down and ignores other frames', () => {
    const { result } = renderHook(() => useClaudeImport(() => false));
    act(() => result.current.onScan());
    expect(result.current.busy).toBe(false);
    expect(result.current.onMsg({ t: 'admin-op', ok: true, message: 'x' })).toBe(false);
  });
});
