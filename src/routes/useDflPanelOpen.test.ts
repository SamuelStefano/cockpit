import { describe, expect, it } from 'vitest';
import type { DflMcpsState } from '../../shared/dfl-mcps';
import { dflPanelOpen } from './useDflPanelOpen';

const state = (...statuses: DflMcpsState['hosts'][number]['status'][]): DflMcpsState => ({
  source: 'manifest',
  hosts: statuses.map((status, i) => ({ host: `h${i}`, endpoint: 'e', name: `dfl-h${i}`, status })),
});

describe('dflPanelOpen', () => {
  it('stays closed when no DFL server was added', () => {
    expect(dflPanelOpen(state('missing', 'missing'), false)).toBe(false);
    expect(dflPanelOpen(null, false)).toBe(false);
  });
  it('opens once any DFL server is configured', () => {
    expect(dflPanelOpen(state('missing', 'needs-auth'), false)).toBe(true);
  });
  it('opens when the user asked for it', () => {
    expect(dflPanelOpen(state('missing'), true)).toBe(true);
  });
});
