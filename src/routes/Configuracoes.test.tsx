// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Configuracoes } from './Configuracoes';
import type { NavRole } from '../components/chrome/nav-routes';
import type { Route } from '../useRoute';

afterEach(cleanup);

const noop = () => {};
const cockpit = {
  usageStats: null, onUsageList: noop, sessions: [], rate: null, accounts: [], accountsLoaded: true, onAccountsList: noop, onSetAdmin: noop,
  stats: null, health: null, onHealthList: noop, adminOp: null, onEnvSet: () => true, onEnvUnset: noop, onMcpAdd: noop, onMcpRemove: noop,
  onCliInstall: noop, onCliUpdate: noop, onDeckRestart: noop, caps: { role: 'admin', canBypass: true }, bypass: false, setBypass: noop,
  claudeAccount: null, claudeLogin: { state: 'idle' }, onClaudeAccountGet: noop, onClaudeLogout: noop,
  onClaudeLoginStart: noop, onClaudeLoginCode: noop, onClaudeLoginCancel: noop,
} as never;
const dock = { planUsage: null, stats: null } as never;

function mount(role: NavRole, route: Route = '/configuracoes', nav: (to: Route) => void = noop) {
  return render(
    <Configuracoes
      route={route} role={role} nav={nav} isMobile={false} connected cockpit={cockpit}
      account={{ onSignOut: noop, onChangePassword: async () => null }} usageDock={dock} onOpenSession={noop} onOpenTerminal={noop}
    />,
  );
}

vi.mock('./AdminInventory', () => ({ AdminInventory: () => <div>inventory-panel</div> }));
const withHealth = { ...(cockpit as object), health: { host: 'h' } } as never;

describe('Configuracoes', () => {
  it('Máquina offers the inventory to admin and root, never to a student', () => {
    for (const role of ['admin', 'root'] as const) {
      render(<Configuracoes route="/configuracoes/maquina" role={role} nav={noop} isMobile={false} connected cockpit={withHealth} account={{}} usageDock={dock} onOpenSession={noop} onOpenTerminal={noop} />);
      expect(screen.getByRole('button', { name: 'Inventário' })).toBeTruthy();
      cleanup();
    }
    render(<Configuracoes route="/configuracoes/maquina" role="student" nav={noop} isMobile={false} connected cockpit={withHealth} account={{}} usageDock={dock} onOpenSession={noop} onOpenTerminal={noop} />);
    expect(screen.queryByRole('button', { name: 'Inventário' })).toBeNull();
  });

  it('root Máquina shows the Claude account card; admin does not', () => {
    render(<Configuracoes route="/configuracoes/maquina" role="root" nav={noop} isMobile={false} connected cockpit={withHealth} account={{}} usageDock={dock} onOpenSession={noop} onOpenTerminal={noop} />);
    expect(screen.getByText('Conta do Claude')).toBeTruthy();
    cleanup();
    render(<Configuracoes route="/configuracoes/maquina" role="admin" nav={noop} isMobile={false} connected cockpit={withHealth} account={{}} usageDock={dock} onOpenSession={noop} onOpenTerminal={noop} />);
    expect(screen.queryByText('Conta do Claude')).toBeNull();
  });

  it('student: Conta only, no subnav', () => {
    mount('student');
    expect(screen.queryByRole('navigation', { name: 'Seções de configurações' })).toBeNull();
    for (const l of ['Mostrar ferramentas', 'Agrupar notas do agente', 'Som ao terminar o turno']) expect(screen.getByRole('switch', { name: l })).toBeTruthy();
    expect(screen.getByText('Trocar senha')).toBeTruthy();
    expect(screen.getByText('Desconectar conta')).toBeTruthy();
  });

  it('student on a restricted section is sent back to Conta', () => {
    const nav = vi.fn();
    mount('student', '/configuracoes/maquina', nav);
    expect(nav).toHaveBeenCalledWith('/configuracoes');
  });

  it('admin: four sections, no Pessoas', () => {
    mount('admin');
    const nav = screen.getByRole('navigation', { name: 'Seções de configurações' });
    expect(nav.textContent).toBe('ContaUsoMáquinaAvançado');
  });

  it('root: Avançado holds bypass, terminal and restart', () => {
    mount('root', '/configuracoes/avancado');
    expect(screen.getByRole('switch', { name: 'Pular aprovações' })).toBeTruthy();
    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.getByText('Reiniciar o Deck')).toBeTruthy();
  });

  it('admin: Avançado has no restart', () => {
    mount('admin', '/configuracoes/avancado');
    expect(screen.queryByText('Reiniciar o Deck')).toBeNull();
  });
});
