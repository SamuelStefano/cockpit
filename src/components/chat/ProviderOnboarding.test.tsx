// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AGENT_PRESETS, type AgentView } from '../../../shared/agents';
import type { AgentsApi } from '../../cockpit/useAgents';
import { takeAgentFocus } from '../../cockpit/provider-onboarding';
import { ProviderOnboarding } from './ProviderOnboarding';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(cleanup);

function api(items: AgentView[] = []): AgentsApi {
  return { items, presets: AGENT_PRESETS, loaded: true, refresh: vi.fn() } as unknown as AgentsApi;
}

describe('ProviderOnboarding', () => {
  it('shows the four providers with detected status and suggests Claude', () => {
    render(<ProviderOnboarding agents={api([{ id: 'grok', name: 'Grok', command: 'grok', args: [], status: 'ready' }])} claudeReady={false} />);
    for (const name of ['Claude', 'Grok', 'OpenCode Go', 'Codex']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText('Instalado e logado')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Configurar Claude' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Configurar Grok' }).getAttribute('aria-checked')).toBe('false');
  });

  it('selecting a provider shows its install command and leads to the Agentes tab', () => {
    const push = vi.spyOn(history, 'pushState');
    render(<ProviderOnboarding agents={api()} claudeReady={false} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Configurar Codex' }));
    expect(screen.getByText(/npm install -g @openai\/codex/)).toBeTruthy();
    fireEvent.click(screen.getByText('Instalar e entrar no terminal'));
    expect(takeAgentFocus()).toBe('codex');
    expect(push).toHaveBeenCalledWith(null, '', '/painel#agents');
  });

  it('lets the user skip Claude', () => {
    render(<ProviderOnboarding agents={api()} claudeReady={false} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Configurar Claude' }));
    expect(screen.queryByText('Conecte sua conta Claude')).toBeNull();
  });
});
