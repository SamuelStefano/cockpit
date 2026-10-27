// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVault } from './useVault';
import type { ClientMsg } from '../../shared/protocol';

const item = { name: 'GH_TOKEN', bytes: 20, agents: ['claude'], createdAt: 1, updatedAt: 2 };

const mount = () => {
  const sent: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { sent.push(m); return true; });
  return { ...renderHook(() => useVault(send)), sent };
};

describe('useVault', () => {
  it('claims vault frames and ignores others', () => {
    const { result } = mount();
    expect(result.current.vaultLoaded).toBe(false);
    act(() => { expect(result.current.onMsg({ t: 'vault', items: [item] })).toBe(true); });
    expect(result.current.vault).toEqual([item]);
    expect(result.current.vaultLoaded).toBe(true);
    expect(result.current.onMsg({ t: 'notes', text: 'x' })).toBe(false);
  });

  it('sends list, put and rm frames; put reports whether the frame left', () => {
    const { result, sent } = mount();
    act(() => {
      result.current.onVaultList();
      expect(result.current.onVaultPut('A_KEY', 'v', ['claude'])).toBe(true);
      result.current.onVaultRm('A_KEY');
    });
    expect(sent).toEqual([
      { t: 'vault-list' },
      { t: 'vault-put', name: 'A_KEY', value: 'v', agents: ['claude'] },
      { t: 'vault-rm', name: 'A_KEY' },
    ]);
  });
});
