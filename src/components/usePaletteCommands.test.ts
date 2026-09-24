// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePaletteCommands } from './usePaletteCommands';
import { navFor } from './chrome/nav-routes';

const noop = () => {};
const base = {
  onClose: noop, nav: noop, onNew: noop, mode: 'auto' as const, setMode: noop, sessions: [], onSelectSession: noop,
  running: new Set<string>(), onStop: noop, onFocusComposer: noop, onSeedComposer: noop, onShowHelp: noop,
};
const navIds = (isAdmin: boolean) => renderHook(() => usePaletteCommands({ ...base, isAdmin })).result.current.filter((c) => c.group === 'Navegar').map((c) => c.id);

describe('usePaletteCommands navigation', () => {
  it('offers every route the header offers', () => {
    expect(navIds(false)).toHaveLength(navFor(false).length);
    expect(navIds(false)).toEqual(expect.arrayContaining(['go-chat', 'go-notas', 'go-pontos', 'go-crons', 'go-play']));
  });

  it('adds the admin-only routes only for admins', () => {
    expect(navIds(false)).not.toContain('go-canvas');
    expect(navIds(true)).toEqual(expect.arrayContaining(['go-canvas', 'go-graph', 'go-harness', 'go-admin']));
  });
});
