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
  it('starts expanded with new-chat and palette as icons in the header', () => {
    const p = setup();
    expect(screen.getByRole('complementary', { name: 'Navegação principal' }).className).toContain('w-75');
    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(p.onNew).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    fireEvent.click(screen.getByRole('button', { name: /^Comandos \((⌘K|Ctrl\+K)\)$/ }));
    expect(p.onPalette).toHaveBeenCalledOnce();
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

  it('lists the routes in the account menu in the fixed order and navigates', () => {
    const p = setup({ role: 'root' });
    expect(screen.queryByRole('navigation', { name: 'Rotas' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    const names = within(screen.getByRole('navigation', { name: 'Rotas' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Canvas', 'Pull requests', 'Pontos', 'Loja', 'Rotinas']);
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    expect(p.nav).toHaveBeenCalledWith('/equipe/rotinas');
    expect(screen.queryByRole('navigation', { name: 'Rotas' })).toBeNull();
  });

  it('puts the settings gear in the footer, next to the account', () => {
    const p = setup({ role: 'root' });
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    expect(p.nav).toHaveBeenCalledWith('/configuracoes');
    expect(screen.queryByRole('button', { name: /^Uso do plano/ })).toBeNull();
  });

  it('keeps a student on Configurações only (no Equipe, Rotinas or Memória)', () => {
    setup({ role: 'student' });
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(screen.queryByRole('button', { name: 'Equipe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rotinas' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Memória' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skills' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conexões' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeTruthy();
  });

  it('keeps the routes reachable from the account menu in the rail', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher barra lateral' }));
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(screen.getByRole('button', { name: 'Canvas' })).toBeTruthy();
  });

  it('marks the current route', () => {
    setup({ route: '/canvas' });
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(screen.getByRole('button', { name: 'Canvas' }).getAttribute('aria-current')).toBe('page');
  });

  it('offers the Store to admin and root, opening /agentes/loja, and hides it from a student', () => {
    for (const role of ['admin', 'root'] as const) {
      const p = setup({ role });
      fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
      fireEvent.click(screen.getByRole('button', { name: 'Loja' }));
      expect(p.nav).toHaveBeenCalledWith('/agentes/loja');
      cleanup();
    }
    setup({ role: 'student' });
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(screen.queryByRole('button', { name: 'Loja' })).toBeNull();
  });

  it('marks Loja as current on the Store route', () => {
    setup({ route: '/agentes/loja' });
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(screen.getByRole('button', { name: 'Loja' }).getAttribute('aria-current')).toBe('page');
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
