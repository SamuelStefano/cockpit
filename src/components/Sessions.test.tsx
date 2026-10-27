// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { SessionsPanel, type SessionsPanelProps } from './Sessions';
import type { Session } from '../data/types';

afterEach(cleanup);

const base: SessionsPanelProps = {
  sessions: [], loading: false, activeId: '', onSelect: () => {}, onNew: () => {}, onRename: () => {}, onClose: () => {},
};

const local: Session = { id: 'new-1', title: 'Nova sessão', relative: 'agora', snippet: 'Sem mensagens ainda', mtime: Date.now(), hasTerminal: false, active: true };

describe('SessionsPanel for a fresh user', () => {
  it('explains the empty list and offers a primary action that works', () => {
    const onNew = vi.fn();
    render(<SessionsPanel {...base} onNew={onNew} />);
    expect(screen.getByText('Nenhuma sessão ainda')).toBeTruthy();
    fireEvent.click(screen.getByText('Criar sessão'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('hides the descriptions toggle while there is nothing to describe', () => {
    render(<SessionsPanel {...base} />);
    expect(screen.queryByLabelText('Alternar descrições das sessões')).toBeNull();
  });

  it('shows the toggle once a session exists', () => {
    render(<SessionsPanel {...base} sessions={[local]} />);
    expect(screen.getByLabelText('Alternar descrições das sessões')).toBeTruthy();
  });

  it('labels the loading skeleton', () => {
    render(<SessionsPanel {...base} loading />);
    expect(screen.getByText('Carregando sessões…')).toBeTruthy();
  });

  it('shows a just-created session even while the server list is still loading', () => {
    render(<SessionsPanel {...base} loading sessions={[local]} />);
    expect(screen.queryByText('Carregando sessões…')).toBeNull();
    expect(screen.getAllByText('Nova sessão').length).toBeGreaterThan(1);
  });
});
