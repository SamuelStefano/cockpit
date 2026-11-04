// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { act } from 'react';

const sent: unknown[] = [];
vi.mock('../../../cockpit/sealed-socket', () => ({ sendRelayFrame: (f: unknown) => { sent.push(f); } }));
vi.mock('../../sessions/AddBoxModal', () => ({ AddBoxModal: () => <div>pairing</div> }));

import { boxStore } from '../../../cockpit/boxes-store';
import { savePref } from '../../../lib/persist';
import { boxUnreadStore } from '../../../cockpit/box-unread';
import { BoxRail } from './BoxRail';
import { LAST_SESSION_PREF, railTargetPath, rememberSession } from './useBoxRail';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const info = (id: string, label: string, online: boolean) => ({ id, label, online, lastSeen: null });
const push = (boxes: unknown[]) => act(() => { boxStore.setPref(A); boxStore.applyFrame({ t: 'boxes', box: null, primary: A, boxes }); });

beforeEach(() => { localStorage.clear(); boxStore.reset(); sent.length = 0; history.replaceState(null, '', '/'); });
afterEach(cleanup);

describe('railTargetPath', () => {
  it('follows the last chat only from the chat view', () => {
    expect(railTargetPath('/c/x', 's1')).toBe('/c/s1');
    expect(railTargetPath('/', 's1')).toBe('/c/s1');
    expect(railTargetPath('/canvas', 's1')).toBeNull();
    expect(railTargetPath('/c/x', undefined)).toBeNull();
  });
});

describe('rememberSession', () => {
  it('ignores drafts and no-ops return the same map', () => {
    const map = { [A]: 's1' };
    expect(rememberSession(map, A, 'new-1')).toBe(map);
    expect(rememberSession(map, A, 's1')).toBe(map);
    expect(rememberSession(map, null, 's2')).toBe(map);
    expect(rememberSession(map, A, 's2')).toEqual({ [A]: 's2' });
  });
});

describe('BoxRail', () => {
  it('renders nothing before the first boxes frame', () => {
    const { container } = render(<BoxRail activeSessionId="" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows with one box and marks it current, with the add tile', () => {
    render(<BoxRail activeSessionId="" />);
    push([info(A, 'VPS', true)]);
    expect(screen.getByRole('button', { name: 'VPS, online' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Adicionar máquina' })).toBeTruthy();
  });

  it('switches box and reopens the last chat of that box', () => {
    render(<BoxRail activeSessionId="" />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    savePref(LAST_SESSION_PREF, { [B]: 's9' });
    fireEvent.click(screen.getByRole('button', { name: 'PC, online' }));
    expect(boxStore.get().pref).toBe(B);
    expect(location.pathname).toBe('/c/s9');
  });

  it('does not redial when clicking the current box', () => {
    const spy = vi.spyOn(boxStore, 'setPref');
    render(<BoxRail activeSessionId="" />);
    push([info(A, 'VPS', true)]);
    spy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'VPS, online' }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('remembers the active session of the current box', () => {
    render(<BoxRail activeSessionId="s3" />);
    push([info(A, 'VPS', true)]);
    expect(JSON.stringify(localStorage)).toContain('s3');
  });

  it('marks red count, white dot and a locked box, never a false empty state', () => {
    render(<BoxRail activeSessionId="" />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    act(() => boxUnreadStore.set(B, { white: 1, red: 2, locked: false }));
    expect(screen.getByRole('button', { name: /PC, online · 2 aguardando você · 1 com novidade/ })).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    act(() => boxUnreadStore.set(B, { white: 0, red: 0, locked: true }));
    expect(screen.getByRole('button', { name: /não está cadastrado/ })).toBeTruthy();
    act(() => boxUnreadStore.reset());
  });

  it('keeps rename and revoke in the context menu', () => {
    render(<BoxRail activeSessionId="" />);
    push([info(A, 'VPS', true), info(B, 'PC', false)]);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'PC, offline' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Renomear' }));
    fireEvent.change(screen.getByLabelText('Novo nome da máquina'), { target: { value: 'Casa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(sent).toContainEqual({ t: 'box-rename', id: B, label: 'Casa' });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'PC, offline' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(sent).toContainEqual({ t: 'box-revoke', id: B });
  });
});
