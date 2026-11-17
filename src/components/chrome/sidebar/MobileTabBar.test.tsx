// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileTabBar, tabsFor } from './MobileTabBar';

afterEach(cleanup);

describe('MobileTabBar', () => {
  it('shows all four tabs to root and admin', () => {
    expect(tabsFor('root').map((t) => t.id)).toEqual(['equipe', 'conversas', 'canvas', 'mais']);
    expect(tabsFor('admin').map((t) => t.id)).toEqual(['equipe', 'conversas', 'canvas', 'mais']);
  });
  it('shows a student only the tabs they can open', () => {
    expect(tabsFor('student').map((t) => t.id)).toEqual(['conversas', 'mais']);
  });
  it('routes tabs navigate, the others open the drawer', () => {
    const onNavigate = vi.fn(); const onConversations = vi.fn(); const onMore = vi.fn();
    render(<MobileTabBar role="root" route="/equipe" onNavigate={onNavigate} onConversations={onConversations} onMore={onMore} />);
    expect(screen.getByRole('button', { name: 'Equipe' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Canvas' }));
    expect(onNavigate).toHaveBeenCalledWith('/canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Conversas' }));
    expect(onConversations).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }));
    expect(onMore).toHaveBeenCalledOnce();
  });
});
