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
    account: {}, ...over,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar', () => {
  it('starts expanded with a big new-chat button and search as header icon and keeps the palette aria-label', () => {
    const p = setup();
    expect(screen.getByRole('complementary', { name: 'Navegação principal' }).className).toContain('w-75');
    expect(screen.queryByText('Buscar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Comandos \((⌘K|Ctrl\+K)\)$/ }));
    expect(p.onPalette).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(p.onNew).toHaveBeenCalledOnce();
  });

  it('collapses to the rail, hides the text and persists the choice', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    expect(screen.getByRole('complementary').className).toContain('w-14');
    expect(screen.getByRole('button', { name: 'Nova conversa' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes(SIDEBAR_COLLAPSED_KEY))!)!)).toBe(true);
  });

  it('on the rail puts Bit first, then the toggle, new chat and the chat tiles', () => {
    setup({ rail: <button aria-label="Chat X">X</button> });
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    const at = (n: string) => names.indexOf(n);
    expect(at('Ir pro chat')).toBe(0);
    expect(at('Expandir barra lateral')).toBe(1);
    expect(at('Nova conversa')).toBeLessThan(at('Chat X'));
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
    expect(names).toEqual(['Canvas', 'Pontos', 'Equipe', 'Skills', 'Conexões', 'Graph', 'Docs']);
    expect(screen.queryByRole('button', { name: 'Mais' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(p.nav).toHaveBeenCalledWith('/skills');
  });

  it('puts the settings gear in the footer, next to the account', () => {
    const p = setup({ role: 'root' });
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    expect(p.nav).toHaveBeenCalledWith('/configuracoes');
    expect(screen.queryByRole('button', { name: /^Uso do plano/ })).toBeNull();
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

  it('drawer mode stays expanded, fills its container and the header button closes it', () => {
    const onClose = vi.fn();
    setup({ drawer: { onClose } });
    expect(screen.getByRole('complementary').className).toContain('w-full');
    expect(screen.getByRole('button', { name: 'Nova conversa' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Recolher barra lateral' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
