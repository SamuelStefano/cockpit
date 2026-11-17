// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { connectionsTabFromHash, openAdminTab } from './admin-nav';

describe('admin-nav', () => {
  it('reads only known Conexões tabs from the hash', () => {
    expect(connectionsTabFromHash('#ferramentas')).toBe('ferramentas');
    expect(connectionsTabFromHash('#nope')).toBeNull();
    expect(connectionsTabFromHash('')).toBeNull();
  });

  it('pushes /configuracoes/conexoes#tab and emits popstate so useRoute switches view', () => {
    const onPop = vi.fn();
    window.addEventListener('popstate', onPop);
    openAdminTab('models');
    window.removeEventListener('popstate', onPop);
    expect(location.pathname + location.hash).toBe('/configuracoes/conexoes#provedores');
    expect(onPop).toHaveBeenCalledOnce();
    openAdminTab('mcps');
    expect(location.hash).toBe('#ferramentas');
  });
});
