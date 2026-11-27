// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileTabBar, tabsFor } from './MobileTabBar';

afterEach(cleanup);

describe('MobileTabBar', () => {
  it('shows four tabs to root and admin', () => {
    expect(tabsFor('root').map((t) => t.id)).toEqual(['chats', 'agentes', 'trabalho', 'mais']);
    expect(tabsFor('admin').map((t) => t.id)).toEqual(['chats', 'agentes', 'trabalho', 'mais']);
  });
  it('shows a student only the tabs they can open', () => {
    expect(tabsFor('student').map((t) => t.id)).toEqual(['chats', 'agentes', 'mais']);
  });
  it('navigates, opens the list and opens "Mais"', () => {
    const onNavigate = vi.fn(); const onConversations = vi.fn(); const onMore = vi.fn();
    render(<MobileTabBar role="root" route="/agentes" onNavigate={onNavigate} onConversations={onConversations} onMore={onMore} />);
    expect(screen.getByRole('button', { name: 'Agentes' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Trabalho' }));
    expect(onNavigate).toHaveBeenCalledWith('/canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Chats' }));
    expect(onConversations).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }));
    expect(onMore).toHaveBeenCalledOnce();
  });
  it('marks Trabalho active on any work route', () => {
    render(<MobileTabBar role="root" route="/pontos" onNavigate={vi.fn()} onConversations={vi.fn()} onMore={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Trabalho' }).getAttribute('aria-current')).toBe('page');
  });
});
