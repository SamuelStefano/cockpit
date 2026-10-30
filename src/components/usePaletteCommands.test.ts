// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { savePref } from '../lib/persist';
import { GAME_ENABLED_KEY } from '../lib/prefs';
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
    expect(navIds('student')).toEqual(['go-chat', 'go-agentes', 'go-configuracoes']);
    expect(navIds('root')).toEqual(expect.arrayContaining(['go-chat', 'go-pontos', 'go-equipe/rotinas', 'go-equipe/memoria']));
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

describe('usePaletteCommands arcade', () => {
  const cmds = (query?: string) => renderHook(() => usePaletteCommands({ ...base, query })).result.current.map((c) => c.id);
  beforeEach(() => localStorage.clear());
  it('offers the arcade commands to every role', () => {
    expect(cmds()).toEqual(expect.arrayContaining(['arcade', 'arcade-runner']));
  });
  it('shows the sandwich command only on the exact phrase', () => {
    expect(cmds()).not.toContain('sudo-sandwich');
    expect(cmds('sudo')).not.toContain('sudo-sandwich');
    expect(cmds('Sudo make me a sandwich ')).toContain('sudo-sandwich');
  });
  it('lists the hidden codes only on the exact word', () => {
    for (const e of ['iddqd', 'matrix', 'konami']) {
      expect(cmds()).not.toContain(`egg-${e}`);
      expect(cmds(e.slice(0, 3))).not.toContain(`egg-${e}`);
      expect(cmds(` ${e.toUpperCase()} `)).toContain(`egg-${e}`);
    }
  });
  it('hides all of it when the game is off', () => {
    savePref(GAME_ENABLED_KEY, false);
    expect(cmds('sudo make me a sandwich')).not.toContain('sudo-sandwich');
    expect(cmds()).not.toContain('arcade');
    expect(cmds('matrix')).not.toContain('egg-matrix');
  });
});
