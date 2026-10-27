// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { act } from 'react';
import type { PeekState } from '../../cockpit/box-peek';

const peekCalls: [string, boolean][] = [];
let peekState: PeekState = { status: 'open', sessions: [], busy: [] };
vi.mock('../../cockpit/useBoxPeek', () => ({
  useBoxPeek: (box: string, enabled: boolean) => { peekCalls.push([box, enabled]); return enabled ? peekState : { status: 'idle', sessions: [], busy: [] }; },
}));
vi.mock('../../cockpit/sealed-socket', () => ({ sendRelayFrame: () => {} }));

import { boxStore } from '../../cockpit/boxes-store';
import { takeNewIntent } from '../../cockpit/box-intent';
import { SessionsPanel, type SessionsPanelProps } from '../Sessions';
import type { Session } from '../../data/types';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const info = (id: string, label: string, online: boolean) => ({ id, label, online, lastSeen: null });
const push = (boxes: unknown[]) => act(() => boxStore.applyFrame({ t: 'boxes', box: null, primary: A, boxes }));
const row: Session = { id: 's-local', title: 'Sessão daqui', relative: 'agora', snippet: '', mtime: Date.now(), hasTerminal: false, active: false };
const base: SessionsPanelProps = { sessions: [row], loading: false, activeId: '', onSelect: () => {}, onNew: () => {}, onRename: () => {}, onClose: () => {} };
const enabledFor = (box: string) => peekCalls.some(([b, on]) => b === box && on);

beforeEach(() => {
  localStorage.clear(); boxStore.reset(); peekCalls.length = 0; takeNewIntent(null);
  peekState = { status: 'open', sessions: [{ id: 's-pc', title: 'Sessão do PC', relative: '2 min', snippet: '', mtime: 1, count: 1 }], busy: ['s-pc'] };
  history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('sidebar grouped by box', () => {
  it('stays a flat list with one box, and Nova sessão needs no question', () => {
    const onNew = vi.fn();
    render(<SessionsPanel {...base} onNew={onNew} />);
    push([info(A, 'VPS', true)]);
    expect(screen.queryByLabelText(/Recolher VPS/)).toBeNull();
    fireEvent.click(screen.getByText('Nova sessão'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('puts the current box first and opens no peek until a header is expanded', () => {
    render(<SessionsPanel {...base} />);
    push([info(B, 'PC', true), info(A, 'VPS', true)]);
    const headers = screen.getAllByRole('button', { name: /^(Recolher|Expandir) / }).map((e) => e.getAttribute('aria-label'));
    expect(headers).toEqual(['Recolher VPS', 'Expandir PC']);
    expect(screen.getByText('Sessão daqui')).toBeTruthy();
    expect(enabledFor(B)).toBe(false);
  });

  it('collapses the current box', () => {
    render(<SessionsPanel {...base} />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    fireEvent.click(screen.getByLabelText('Recolher VPS'));
    expect(screen.queryByText('Sessão daqui')).toBeNull();
  });

  it('peeks another online box when expanded, and a click switches to it on that chat', () => {
    render(<SessionsPanel {...base} />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    fireEvent.click(screen.getByLabelText('Expandir PC'));
    expect(enabledFor(B)).toBe(true);
    expect(screen.getByLabelText('rodando')).toBeTruthy();
    fireEvent.click(screen.getByText('Sessão do PC'));
    expect(location.pathname).toBe('/c/s-pc');
    expect(boxStore.get().pref).toBe(B);
  });

  it('never peeks an offline box and greys it out', () => {
    render(<SessionsPanel {...base} />);
    push([info(A, 'VPS', true), info(C, 'Notebook', false)]);
    const header = screen.getByLabelText('Expandir Notebook');
    expect(header.className).toContain('text-neutral-600');
    fireEvent.click(header);
    expect(screen.getByText('Máquina offline.')).toBeTruthy();
    expect(enabledFor(C)).toBe(false);
  });

  it('says so when this device is not enrolled on the other box', () => {
    peekState = { status: 'locked', sessions: [], busy: [] };
    render(<SessionsPanel {...base} />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    fireEvent.click(screen.getByLabelText('Expandir PC'));
    expect(screen.getByText(/não está cadastrado nesta máquina/)).toBeTruthy();
  });

  it('Nova sessão asks which box, current first', () => {
    const onNew = vi.fn();
    render(<SessionsPanel {...base} onNew={onNew} />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    fireEvent.click(screen.getByText('Nova sessão'));
    const items = screen.getAllByRole('menuitem').map((e) => e.textContent);
    expect(items[0]).toContain('VPS');
    fireEvent.click(screen.getAllByRole('menuitem')[0]);
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(boxStore.get().pref).toBe(A);
  });

  it('a new session on another box switches to it and is created there', () => {
    const onNew = vi.fn();
    render(<SessionsPanel {...base} onNew={onNew} />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    fireEvent.click(screen.getByText('Nova sessão'));
    fireEvent.click(screen.getByRole('menuitem', { name: /PC/ }));
    expect(onNew).not.toHaveBeenCalled();
    expect(boxStore.get().pref).toBe(B);
    expect(takeNewIntent(B)).toBe(true);
  });
});
