// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar, type SidebarProps } from './Sidebar';
import { SIDEBAR_COLLAPSED_KEY } from './useSidebarCollapsed';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function setup(over: Partial<SidebarProps> = {}) {
  const props: SidebarProps = {
    route: '/', nav: vi.fn(), role: 'admin', onNew: vi.fn(), onPalette: vi.fn(), bitState: 'idle', conn: 'connected',
    usage: { planUsage: null, stats: null }, account: {}, ...over,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar', () => {
  it('starts expanded with text labels and keeps the palette aria-label', () => {
    const p = setup();
    expect(screen.getByRole('complementary', { name: 'Navegação principal' }).className).toContain('w-66');
    expect(screen.getByText('Nova conversa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Comandos \((⌘K|Ctrl\+K)\)$/ }));
    expect(p.onPalette).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(p.onNew).toHaveBeenCalledOnce();
  });

  it('collapses to the rail, hides the text and persists the choice', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    expect(screen.getByRole('complementary').className).toContain('w-14');
    expect(screen.queryByText('Nova conversa')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nova conversa' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes(SIDEBAR_COLLAPSED_KEY))!)!)).toBe(true);
  });

  it('restores the collapsed state from storage', () => {
    cleanup();
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    cleanup();
    setup();
    expect(screen.getByRole('complementary').className).toContain('w-14');
  });

  it('shows the footer nav in the fixed order and navigates', () => {
    const p = setup({ role: 'root' });
    const names = within(screen.getByRole('navigation', { name: 'Rotas' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Equipe', 'Skills', 'Conexões', 'Configurações']);
    expect(screen.queryByRole('button', { name: 'Mais' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(p.nav).toHaveBeenCalledWith('/skills');
  });

  it('keeps a student on Equipe and Configurações only', () => {
    setup({ role: 'student' });
    expect(screen.getByRole('button', { name: 'Equipe' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skills' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conexões' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeTruthy();
  });

  it('keeps the footer entries as icons in the rail', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    expect(screen.getByRole('button', { name: 'Conexões' })).toBeTruthy();
    expect(screen.queryByText('Conexões')).toBeNull();
  });

  it('marks the current route', () => {
    setup({ route: '/skills' });
    expect(screen.getByRole('button', { name: 'Skills' }).getAttribute('aria-current')).toBe('page');
  });

  it('embeds the conversations list only while expanded', () => {
    setup({ sessions: <div>lista de conversas</div> });
    expect(screen.getByText('lista de conversas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    expect(screen.queryByText('lista de conversas')).toBeNull();
  });

  it('shows the agents section in both modes', () => {
    const onOpen = vi.fn();
    const views = ['ana01', 'bia02'].map((id) => ({ bot: { id, name: id.toUpperCase(), mascot: { shape: 'drop', color: '#fff' } }, key: id, preview: '', unread: false, state: 'idle' })) as never;
    setup({ agents: { views, activeId: null, onOpen, onNew: vi.fn() } });
    fireEvent.click(screen.getByRole('button', { name: 'BIA02' }));
    expect(onOpen).toHaveBeenCalledWith('bia02');
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    expect(screen.getByRole('button', { name: 'ANA01' })).toBeTruthy();
  });

  it('shows the usage reading in the ring button name, not as visible text', () => {
    setup({ usage: { planUsage: { fiveHour: 48, sevenDay: 10, resetsAt: Date.now() + 3600_000, sevenDayResetsAt: null, limits: [] }, stats: null, planReadAt: Date.now() } });
    const btn = screen.getByRole('button', { name: /^Uso do plano: 48%/ });
    expect(btn.textContent).toBe('');
  });

  it('opens the usage popover with the VPS meters', () => {
    setup({ usage: { planUsage: null, stats: { cpu: 42, load: 1, mem: { used: 1, total: 2 } } as never } });
    fireEvent.click(screen.getByRole('button', { name: /^Uso do plano/ }));
    expect(screen.getByRole('group', { name: /^CPU 42%/ })).toBeTruthy();
    expect(screen.getByRole('group', { name: /^RAM 50%/ })).toBeTruthy();
  });

  it('drawer mode stays expanded, fills its container and the header button closes it', () => {
    const onClose = vi.fn();
    setup({ drawer: { onClose } });
    expect(screen.getByRole('complementary').className).toContain('w-full');
    expect(screen.getByText('Nova conversa')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Recolher barra lateral' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
