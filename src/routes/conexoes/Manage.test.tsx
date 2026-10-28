// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { ManageProviders, ManageTools, type ManageProps } from './Manage';
import { Conexoes } from '../Conexoes';
import { roleRedirect } from '../../components/chrome/nav-routes';

vi.mock('../AdminAgents', () => ({ AdminAgents: ({ isRoot }: { isRoot: boolean }) => <div>agents-panel root={String(isRoot)}</div> }));
vi.mock('../AdminModels', () => ({ AdminModels: () => <div>models-panel</div> }));
vi.mock('../AdminMcps', () => ({ AdminMcps: () => <div>mcps-panel</div> }));

afterEach(cleanup);

const manage = { agents: {}, onMcpsGet: vi.fn(), term: {}, models: [], isRoot: false, onOpenAgentChat: vi.fn() } as unknown as ManageProps;
const conn = { connected: true, items: [], loaded: true, bots: [], mcpsState: null, mcpsBusy: false, onGet: vi.fn(), onGo: vi.fn() };

describe('Conexões manage panels', () => {
  it('provider panels stay closed until opened, then show agents and models', () => {
    render(<ManageProviders {...manage} isRoot />);
    expect(screen.queryByText('models-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar provedores e modelos' }));
    expect(screen.getByText('agents-panel root=true')).toBeTruthy();
    expect(screen.getByText('models-panel')).toBeTruthy();
  });

  it('tool panel opens the MCP login panel', () => {
    render(<ManageTools {...manage} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar ferramentas' }));
    expect(screen.getByText('mcps-panel')).toBeTruthy();
  });

  it('Provedores tab hosts the provider panel, Ferramentas the tool panel', () => {
    render(<Conexoes {...conn} manage={{ provedores: <ManageProviders {...manage} />, ferramentas: <ManageTools {...manage} /> }} />);
    expect(screen.getByRole('button', { name: 'Gerenciar provedores e modelos' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gerenciar ferramentas' })).toBeNull();
  });

  it('a student never reaches Conexões', () => {
    expect(roleRedirect('student', '/conexoes', '', false)).toBe('/equipe');
    expect(roleRedirect('admin', '/conexoes', '', false)).toBeNull();
    expect(roleRedirect('root', '/conexoes', '', false)).toBeNull();
  });
});
