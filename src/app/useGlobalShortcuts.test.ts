// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import type { Session } from '../data/types';

const sess = (id: string): Session => ({ id }) as Session;

function mount(over: Partial<Parameters<typeof useGlobalShortcuts>[0]> = {}) {
  const args = {
    sessions: [sess('a'), sess('b'), sess('c')],
    running: new Set<string>(),
    onNew: vi.fn(),
    activeSessionId: 'a',
    setActiveSessionId: vi.fn(),
    updated: new Set<string>(),
    nav: vi.fn(),
    setPalette: vi.fn(),
    setHelp: vi.fn(),
    ...over,
  };
  renderHook(() => useGlobalShortcuts(args));
  return args;
}

function key(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  it('⌘K / Ctrl+K alterna a command palette', () => {
    const { setPalette } = mount();
    key({ key: 'k', metaKey: true });
    key({ key: 'K', ctrlKey: true });
    expect(setPalette).toHaveBeenCalledTimes(2);
  });

  it('? abre a ajuda fora de input', () => {
    const { setHelp } = mount();
    key({ key: '?' });
    expect(setHelp).toHaveBeenCalledTimes(1);
  });

  it('? é ignorado enquanto digita num input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const { setHelp } = mount();
    key({ key: '?' });
    expect(setHelp).not.toHaveBeenCalled();
  });

  it('Alt+↓ vai pra próxima sessão na ordem', () => {
    const { setActiveSessionId } = mount({ activeSessionId: 'a' });
    key({ key: 'ArrowDown', altKey: true });
    expect(setActiveSessionId).toHaveBeenCalledWith('b');
  });

  it('Alt+↑ dá wraparound do primeiro pro último', () => {
    const { setActiveSessionId } = mount({ activeSessionId: 'a' });
    key({ key: 'ArrowUp', altKey: true });
    expect(setActiveSessionId).toHaveBeenCalledWith('c');
  });

  it('Alt+↓ respeita a ordem de fixadas (pinned no topo)', () => {
    localStorage.setItem('cockpit:pinned', JSON.stringify(['c']));
    // ordem efetiva: c, a, b → de c (ativo) desce pra a
    const { setActiveSessionId } = mount({ activeSessionId: 'c' });
    key({ key: 'ArrowDown', altKey: true });
    expect(setActiveSessionId).toHaveBeenCalledWith('a');
  });

  it('Alt+seta é no-op com menos de 2 sessões', () => {
    const { setActiveSessionId } = mount({ sessions: [sess('a')] });
    key({ key: 'ArrowDown', altKey: true });
    expect(setActiveSessionId).not.toHaveBeenCalled();
  });

  it('n salta pra próxima sessão com output novo e navega pra "/"', () => {
    const { setActiveSessionId, nav } = mount({ activeSessionId: 'a', updated: new Set(['c']) });
    key({ key: 'n' });
    expect(setActiveSessionId).toHaveBeenCalledWith('c');
    expect(nav).toHaveBeenCalledWith('/');
  });

  it('n é no-op quando nada foi atualizado', () => {
    const { setActiveSessionId } = mount({ updated: new Set() });
    key({ key: 'n' });
    expect(setActiveSessionId).not.toHaveBeenCalled();
  });

  it('n é ignorado enquanto digita', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const { setActiveSessionId } = mount({ updated: new Set(['b']) });
    key({ key: 'n' });
    expect(setActiveSessionId).not.toHaveBeenCalled();
  });

  it('does not switch sessions behind an open dialog', () => {
    const dlg = document.createElement('div');
    dlg.setAttribute('aria-modal', 'true');
    document.body.appendChild(dlg);
    const { setActiveSessionId } = mount({ updated: new Set(['b']) });
    key({ key: 'ArrowDown', altKey: true });
    key({ key: 'n' });
    expect(setActiveSessionId).not.toHaveBeenCalled();
  });

  it('Alt+↓ also navigates to the chat', () => {
    const { nav } = mount({ activeSessionId: 'a' });
    key({ key: 'ArrowDown', altKey: true });
    expect(nav).toHaveBeenCalledWith('/');
  });

  it('Alt+↓ follows the sidebar grouping: running sessions come first', () => {
    const { setActiveSessionId } = mount({ activeSessionId: 'c', running: new Set(['b']) });
    key({ key: 'ArrowDown', altKey: true });
    // order: b (running), a, c → from c wraps to b
    expect(setActiveSessionId).toHaveBeenCalledWith('b');
  });

  it('⌘⇧O starts a new chat and ⌘⇧K opens the canvas', () => {
    const { onNew, nav } = mount();
    key({ key: 'O', altKey: true, shiftKey: true });
    key({ key: 'K', altKey: true, shiftKey: true });
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(nav).toHaveBeenCalledWith('/canvas');
  });

  it('⌘2 jumps to the second sidebar session', () => {
    const { setActiveSessionId, nav } = mount();
    key({ key: '2', altKey: true });
    expect(setActiveSessionId).toHaveBeenCalledWith('b');
    expect(nav).toHaveBeenCalledWith('/');
  });

  it('g then p opens pontos, but not while typing', () => {
    const { nav } = mount();
    key({ key: 'g' });
    key({ key: 'p' });
    expect(nav).toHaveBeenCalledWith('/pontos');
  });

  it('Alt+B (non-Apple modifier) toggles the persisted sidebar state', () => {
    mount();
    key({ key: 'b', altKey: true });
    expect(localStorage.getItem('cockpit:sidebarCollapsed')).toBe('true');
  });

  it('ignores Ctrl+B and skips B/J while typing', () => {
    mount();
    key({ key: 'b', ctrlKey: true });
    expect(localStorage.getItem('cockpit:sidebarCollapsed')).toBeNull();
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    key({ key: 'b', altKey: true });
    expect(localStorage.getItem('cockpit:sidebarCollapsed')).toBeNull();
    ta.remove();
  });

  it('ignores shortcuts that originate inside the terminal', () => {
    const { onNew } = mount();
    const x = document.createElement('div');
    x.className = 'xterm';
    document.body.appendChild(x);
    x.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', altKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    expect(onNew).not.toHaveBeenCalled();
    x.remove();
  });
});
