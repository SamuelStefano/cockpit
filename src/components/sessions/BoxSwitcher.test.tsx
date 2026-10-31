// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { act } from 'react';

const sent: unknown[] = [];
vi.mock('../../cockpit/sealed-socket', () => ({ sendRelayFrame: (f: unknown) => { sent.push(f); } }));
vi.mock('./BoxPairing', () => ({ BoxPairing: () => <div>pairing</div> }));

import { boxStore } from '../../cockpit/boxes-store';
import { BoxSwitcher } from './BoxSwitcher';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const info = (id: string, label: string, online: boolean) => ({ id, label, online, lastSeen: null });
const push = (boxes: unknown[], primary: string | null = A) => act(() => boxStore.applyFrame({ t: 'boxes', box: null, primary, boxes }));

beforeEach(() => { localStorage.clear(); boxStore.reset(); sent.length = 0; });
afterEach(cleanup);

describe('BoxSwitcher', () => {
  it('renders nothing before the first boxes frame', () => {
    const { container } = render(<BoxSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('shows compactly with one box and still offers Adicionar à Fleet', () => {
    render(<BoxSwitcher />);
    push([info(A, 'VPS', true)]);
    expect(screen.getByText('VPS')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Trocar de máquina'));
    expect(screen.getByText('Adicionar à Fleet')).toBeTruthy();
  });

  it('labels an unnamed box with the short id', () => {
    render(<BoxSwitcher />);
    push([info(A, '', true), info(B, 'PC', false)]);
    expect(screen.getByText('11111111 · sem nome')).toBeTruthy();
  });

  it('lists online boxes first and switches on click', () => {
    render(<BoxSwitcher />);
    push([info(B, 'PC', false), info(A, 'VPS', true)]);
    fireEvent.click(screen.getByLabelText('Trocar de máquina'));
    const items = screen.getAllByRole('menuitem').map((e) => e.textContent);
    expect(items.indexOf('VPS')).toBeLessThan(items.indexOf('PC'));
    fireEvent.click(screen.getByText('PC'));
    expect(boxStore.get().pref).toBe(B);
  });

  it('revoke needs a confirmation step', () => {
    render(<BoxSwitcher />);
    push([info(A, 'VPS', true), info(B, 'PC', false)]);
    fireEvent.click(screen.getByLabelText('Trocar de máquina'));
    fireEvent.click(screen.getByLabelText('Remover PC'));
    expect(sent).toHaveLength(0);
    fireEvent.click(screen.getByText('Remover'));
    expect(sent).toEqual([{ t: 'box-revoke', id: B }]);
  });

  it('warns that revoking the current box disconnects', () => {
    render(<BoxSwitcher />);
    push([info(A, 'VPS', true), info(B, 'PC', false)]);
    fireEvent.click(screen.getByLabelText('Trocar de máquina'));
    fireEvent.click(screen.getByLabelText('Remover VPS'));
    expect(screen.getByText(/desconecta o Deck/)).toBeTruthy();
  });

  it('sanitizes the label before renaming', () => {
    render(<BoxSwitcher />);
    push([info(A, 'VPS', true)]);
    fireEvent.click(screen.getByLabelText('Trocar de máquina'));
    fireEvent.click(screen.getByLabelText('Renomear VPS'));
    const input = screen.getByLabelText('Novo nome da máquina');
    fireEvent.change(input, { target: { value: '  Casa‮  1 ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(sent).toEqual([{ t: 'box-rename', id: A, label: 'Casa 1' }]);
  });

  it('opens the pairing panel from the menu', () => {
    render(<BoxSwitcher />);
    push([info(A, 'VPS', true)]);
    fireEvent.click(screen.getByLabelText('Trocar de máquina'));
    fireEvent.click(screen.getByText('Adicionar à Fleet'));
    expect(screen.getByText('pairing')).toBeTruthy();
  });
});
