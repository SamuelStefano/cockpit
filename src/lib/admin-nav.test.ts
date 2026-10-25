// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { adminTabFromHash, openAdminTab, replaceAdminTabHash } from './admin-nav';

describe('admin-nav', () => {
  it('reads only known tabs from the hash', () => {
    expect(adminTabFromHash('#models', ['overview', 'models'])).toBe('models');
    expect(adminTabFromHash('#nope', ['overview'])).toBeNull();
    expect(adminTabFromHash('', ['overview'])).toBeNull();
  });

  it('pushes /painel#tab and emits popstate so useRoute switches view', () => {
    const onPop = vi.fn();
    window.addEventListener('popstate', onPop);
    openAdminTab('models');
    window.removeEventListener('popstate', onPop);
    expect(location.pathname + location.hash).toBe('/painel#models');
    expect(onPop).toHaveBeenCalledOnce();
  });

  it('replaces the hash without leaving the page', () => {
    history.replaceState(null, '', '/painel#overview');
    replaceAdminTabHash('host');
    expect(location.pathname + location.hash).toBe('/painel#host');
  });
});
