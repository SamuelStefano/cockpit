// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { act } from 'react';

const sent: unknown[] = [];
vi.mock('../../cockpit/sealed-socket', () => ({ sendRelayFrame: (f: unknown) => { sent.push(f); } }));
vi.mock('../../components/sessions/AddBoxModal', () => ({ AddBoxModal: () => <div>pairing</div> }));

import { boxStore } from '../../cockpit/boxes-store';
import { boxUnreadStore } from '../../cockpit/box-unread';
import { savePref } from '../../lib/persist';
import { LAST_SESSION_PREF } from '../../cockpit/box-open';
import { Maquinas } from './Maquinas';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const info = (id: string, label: string, online: boolean) => ({ id, label, online, lastSeen: null });
const push = (boxes: unknown[]) => act(() => { boxStore.setPref(A); boxStore.applyFrame({ t: 'boxes', box: null, primary: A, boxes }); });

beforeEach(() => { localStorage.clear(); boxStore.reset(); sent.length = 0; history.replaceState(null, '', '/'); });
afterEach(() => { cleanup(); act(() => boxUnreadStore.reset()); });

describe('Settings › Máquinas', () => {
  it('offers pairing when there is no machine yet', () => {
    render(<Maquinas />);
    expect(screen.getByText('Nenhuma máquina ainda')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar máquina' })[0]);
    expect(screen.getByText('pairing')).toBeTruthy();
  });

  it('lists every machine and marks the current one', () => {
    render(<Maquinas />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    expect(screen.getByRole('list', { name: 'Máquinas' }).textContent).toContain('VPS');
    expect(screen.getByText('atual')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Trocar para VPS' })).toBeNull();
  });

  it('switches machine and reopens its last chat', () => {
    render(<Maquinas />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    savePref(LAST_SESSION_PREF, { [B]: 's9' });
    fireEvent.click(screen.getByRole('button', { name: 'Trocar para PC' }));
    expect(boxStore.get().pref).toBe(B);
    expect(location.pathname).toBe('/c/s9');
  });

  it('shows unread counts and a locked machine', () => {
    render(<Maquinas />);
    push([info(A, 'VPS', true), info(B, 'PC', true)]);
    act(() => boxUnreadStore.set(B, { white: 1, red: 2, locked: false }));
    expect(screen.getByText('2 aguardando')).toBeTruthy();
    expect(screen.getByText('1 novidade')).toBeTruthy();
    act(() => boxUnreadStore.set(B, { white: 0, red: 0, locked: true }));
    expect(screen.getByText('sem acesso')).toBeTruthy();
  });

  it('renames and revokes a machine', () => {
    render(<Maquinas />);
    push([info(A, 'VPS', true), info(B, 'PC', false)]);
    fireEvent.click(screen.getByRole('button', { name: 'Renomear PC' }));
    fireEvent.change(screen.getByLabelText('Novo nome da máquina'), { target: { value: 'Casa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(sent).toContainEqual({ t: 'box-rename', id: B, label: 'Casa' });
    fireEvent.click(screen.getByRole('button', { name: 'Remover PC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(sent).toContainEqual({ t: 'box-revoke', id: B });
  });
});
