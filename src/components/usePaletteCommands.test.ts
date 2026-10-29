// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePaletteCommands } from './usePaletteCommands';
import { navFor, type NavRole } from './chrome/nav-routes';

const noop = () => {};
const base = {
  onClose: noop, nav: noop, onNew: noop, mode: 'auto' as const, setMode: noop, sessions: [], onSelectSession: noop,
  running: new Set<string>(), onStop: noop, onFocusComposer: noop, onShowHelp: noop,
};
const navIds = (role: NavRole) => renderHook(() => usePaletteCommands({ ...base, role })).result.current.filter((c) => c.group === 'Navegar').map((c) => c.id);

describe('usePaletteCommands navigation', () => {
  it('offers every route the header offers', () => {
    expect(navIds('student')).toHaveLength(navFor('student').length);
    expect(navIds('student')).toEqual(['go-chat', 'go-equipe', 'go-configuracoes']);
    expect(navIds('root')).toEqual(expect.arrayContaining(['go-chat', 'go-pontos', 'go-equipe/rotinas', 'go-equipe']));
  });

  it('adds the admin-only routes only for admins', () => {
    expect(navIds('student')).not.toContain('go-canvas');
    expect(navIds('admin')).toEqual(expect.arrayContaining(['go-canvas', 'go-graph', 'go-conexoes']));
  });

  it('offers pontos to root only', () => {
    expect(navIds('root')).toContain('go-pontos');
    expect(navIds('admin')).not.toContain('go-pontos');
    expect(navIds('student')).not.toContain('go-pontos');
  });

  it('never offers the retired screens', () => {
    for (const r of ['root', 'admin', 'student'] as const) {
      for (const gone of ['go-notas', 'go-play', 'go-harness', 'go-admin']) expect(navIds(r)).not.toContain(gone);
    }
  });
});

describe('usePaletteCommands prompt link', () => {
  const ids = (draft?: string) => renderHook(() => usePaletteCommands({ ...base, draft })).result.current.map((c) => c.id);
  it('offers the copy command only with a non-empty draft', () => {
    expect(ids('')).not.toContain('copy-prompt-link');
    expect(ids('   ')).not.toContain('copy-prompt-link');
    expect(ids('olá')).toContain('copy-prompt-link');
  });
});
