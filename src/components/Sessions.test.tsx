// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { subscribeToast, type ToastItem } from './primitives/toast-bus';
import { SessionsPanel, type SessionsPanelProps } from './Sessions';
import type { Session } from '../data/types';

afterEach(cleanup);

const base: SessionsPanelProps = {
  sessions: [], loading: false, activeId: '', onSelect: () => {}, onNew: () => {}, onRename: () => {}, onClose: () => {},
};

const local: Session = { id: 'new-1', title: 'Nova sessão', relative: 'agora', snippet: 'Sem mensagens ainda', mtime: Date.now(), hasTerminal: false, active: true };

describe('SessionsPanel for a fresh user', () => {
  it('renders nothing but the box switcher for an empty list', () => {
    render(<SessionsPanel {...base} />);
    expect(screen.queryByText('Nenhuma sessão ainda')).toBeNull();
    expect(screen.queryByLabelText('Buscar sessões')).toBeNull();
    expect(screen.queryByLabelText('Alternar descrições das sessões')).toBeNull();
  });

  it('labels the loading skeleton', () => {
    render(<SessionsPanel {...base} loading />);
    expect(screen.getByText('Carregando sessões…')).toBeTruthy();
  });

  it('shows a just-created session even while the server list is still loading', () => {
    render(<SessionsPanel {...base} loading sessions={[local]} />);
    expect(screen.queryByText('Carregando sessões…')).toBeNull();
    expect(screen.getByText('Nova sessão')).toBeTruthy();
  });
});

describe('SessionsPanel archive with undo', () => {
  const real: Session = { ...local, id: 'abc', title: 'Sessão real' };

  function setup(extra: Partial<SessionsPanelProps> = {}) {
    const onClose = vi.fn();
    const onDelete = vi.fn();
    const onUnhide = vi.fn();
    const onSelect = vi.fn();
    const toasts: ToastItem[] = [];
    const off = subscribeToast((t) => toasts.push(t));
    render(<SessionsPanel {...base} sessions={[real]} activeId="abc" onClose={onClose} onDelete={onDelete} onUnhide={onUnhide} onSelect={onSelect} {...extra} />);
    fireEvent.click(screen.getByTitle('Ações'));
    return { onClose, onDelete, onUnhide, onSelect, toasts, off };
  }

  it('archives at once, without a dialog, and toasts an undo action', () => {
    const { onClose, toasts, off } = setup();
    fireEvent.click(screen.getByText('Arquivar'));
    off();
    expect(onClose).toHaveBeenCalledWith('abc');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Sessão arquivada');
    expect(toasts[0].action?.label).toBe('Desfazer');
  });

  it('undo unhides the session and re-selects it when it was the active one', () => {
    const { onUnhide, onSelect, toasts, off } = setup();
    fireEvent.click(screen.getByText('Arquivar'));
    off();
    toasts[0].action!.onClick();
    expect(onUnhide).toHaveBeenCalledWith('abc');
    expect(onSelect).toHaveBeenCalledWith('abc');
  });

  it('undo does not steal focus when the archived session was not active', () => {
    const { onUnhide, onSelect, toasts, off } = setup({ activeId: 'other' });
    fireEvent.click(screen.getByText('Arquivar'));
    off();
    toasts[0].action!.onClick();
    expect(onUnhide).toHaveBeenCalledWith('abc');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('delete still asks for confirmation', () => {
    const { onDelete, onClose, toasts, off } = setup();
    fireEvent.click(screen.getByText('Excluir'));
    off();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(toasts).toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'Excluir sessão?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onDelete).toHaveBeenCalledWith('abc');
  });
});
