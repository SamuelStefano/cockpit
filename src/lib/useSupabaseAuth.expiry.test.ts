// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const sb = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    refreshSession: vi.fn(async () => ({ data: {}, error: null })),
  },
}));
vi.mock('./supabase', () => ({ supabase: sb, SUPABASE_ENABLED: true }));

import { useSupabaseAuth } from './useSupabaseAuth';
import { TOKEN_EXPIRED_EVENT } from './auth-events';

describe('token expired on the relay socket', () => {
  it('asks supabase for a fresh token (a hidden tab is not auto-refreshing)', () => {
    const hook = renderHook(() => useSupabaseAuth(() => {}));
    window.dispatchEvent(new Event(TOKEN_EXPIRED_EVENT));
    expect(sb.auth.refreshSession).toHaveBeenCalledOnce();
    hook.unmount();
    window.dispatchEvent(new Event(TOKEN_EXPIRED_EVENT));
    expect(sb.auth.refreshSession).toHaveBeenCalledOnce();
  });
});
