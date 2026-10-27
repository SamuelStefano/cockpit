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
