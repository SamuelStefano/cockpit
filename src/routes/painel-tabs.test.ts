import { describe, it, expect } from 'vitest';
import { painelTabs } from './painel-tabs';

const ids = (isRoot: boolean, accounts: boolean) => painelTabs(isRoot, accounts).map((t) => t.id);

describe('painelTabs', () => {
  it('root sees every section', () => {
    expect(ids(true, true)).toEqual(['overview', 'accounts', 'host', 'mcps', 'agents', 'models']);
  });

  it('a plain admin gets overview, agents and models only', () => {
    expect(ids(false, true)).toEqual(['overview', 'mcps', 'agents', 'models']);
  });

  it('accounts need Supabase even for root', () => {
    expect(ids(true, false)).toEqual(['overview', 'host', 'mcps', 'agents', 'models']);
  });
});
