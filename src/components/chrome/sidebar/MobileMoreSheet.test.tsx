// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileMoreSheet } from './MobileMoreSheet';

afterEach(cleanup);

const base = { route: '/agentes' as const, pending: 2, conn: 'connected' as const, account: {}, onNavigate: vi.fn(), onSearch: vi.fn(), onClose: vi.fn() };

describe('MobileMoreSheet', () => {
  it('lists Equipe with its count, Explorar, Buscar and Configurações for an admin', () => {
    render(<MobileMoreSheet {...base} role="admin" />);
    expect(screen.getByRole('button', { name: 'Equipe' })).toBeTruthy();
    expect(screen.getByTitle('2 esperando você')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Explorar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeTruthy();
  });
  it('hides what a student cannot open', () => {
    render(<MobileMoreSheet {...base} role="student" />);
    expect(screen.queryByRole('button', { name: 'Equipe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Explorar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeTruthy();
  });
  it('navigates and closes', () => {
    const onNavigate = vi.fn(); const onClose = vi.fn(); const onSearch = vi.fn();
    render(<MobileMoreSheet {...base} role="root" onNavigate={onNavigate} onClose={onClose} onSearch={onSearch} />);
    fireEvent.click(screen.getByRole('button', { name: 'Equipe' }));
    expect(onNavigate).toHaveBeenCalledWith('/equipe');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(onSearch).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
