// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { parseAgents, useVaultForm } from './useVaultForm';
import type { VaultApi } from '../../cockpit/useVault';

const mkApi = (put = true): VaultApi => ({
  vault: [], vaultLoaded: false, onVaultList: vi.fn(), onVaultPut: vi.fn(() => put), onVaultRm: vi.fn(),
});

describe('parseAgents', () => {
  it('splits, dedupes and validates', () => {
    expect(parseAgents('claude, grok claude')).toEqual(['claude', 'grok']);
    expect(parseAgents('')).toEqual([]);
    expect(parseAgents('Bad Agent')).toBeNull();
  });
});

describe('useVaultForm', () => {
  it('lists when opened, sends the put and clears the value from state', () => {
    const api = mkApi();
    const { result } = renderHook(() => useVaultForm(api, true));
    expect(api.onVaultList).toHaveBeenCalled();
    act(() => { result.current.setName('GH_TOKEN'); result.current.setValue('ghp_x'); });
    act(() => { result.current.submit(); });
    expect(api.onVaultPut).toHaveBeenCalledWith('GH_TOKEN', 'ghp_x', ['claude']);
    expect(result.current.value).toBe('');
    expect(result.current.name).toBe('');
  });

  it('keeps the value when the frame did not leave', () => {
    const api = mkApi(false);
    const { result } = renderHook(() => useVaultForm(api, false));
    act(() => { result.current.setName('GH_TOKEN'); result.current.setValue('ghp_x'); });
    act(() => { result.current.submit(); });
    expect(result.current.value).toBe('ghp_x');
    expect(result.current.erro).toContain('sem conexão');
  });

  it('refuses reserved and lowercase names without sending', () => {
    const api = mkApi();
    const { result } = renderHook(() => useVaultForm(api, false));
    for (const n of ['PATH', 'lower', 'LD_PRELOAD']) {
      act(() => { result.current.setName(n); result.current.setValue('v'); });
      act(() => { result.current.submit(); });
    }
    expect(api.onVaultPut).not.toHaveBeenCalled();
  });
});
