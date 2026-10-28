// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AGENT_PRESETS, type AgentView } from '../../shared/agents';
import type { AgentsApi } from '../cockpit/useAgents';
import { takeAgentFocus } from '../cockpit/provider-onboarding';
import { Onboarding } from './Onboarding';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(cleanup);

function api(items: AgentView[] = []) {
  return { items, presets: AGENT_PRESETS, loaded: true, refresh: vi.fn(), connect: vi.fn(), test: vi.fn() } as unknown as AgentsApi;
}

describe('Onboarding', () => {
  it('shows every provider and disables the unsupported ones', () => {
    render(<Onboarding agents={api()} claudeReady={false} onDone={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Conecte um provedor' })).toBeTruthy();
    for (const name of ['Claude Code', 'Codex (OpenAI)', 'Gemini', 'Grok', 'Z.AI (GLM)', 'DeepSeek', 'Modelo local (Ollama)', 'Outro endereço compatível']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getAllByText('em breve')).toHaveLength(4);
  });

  it('starts the Claude login and shows the code step while waiting', () => {
    const onStart = vi.fn();
    const { rerender } = render(<Onboarding agents={api()} claudeReady={false} login={{ state: 'idle' }} onStart={onStart} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    expect(onStart).toHaveBeenCalled();
    rerender(<Onboarding agents={api()} claudeReady={false} login={{ state: 'url', url: 'https://x.test' }} onStart={onStart} onDone={vi.fn()} />);
    expect(screen.getByText('Esperando você entrar no navegador')).toBeTruthy();
    expect(screen.getByLabelText('Código da Anthropic')).toBeTruthy();
  });

  it('installing an agent connects it and leads to the Agentes tab', () => {
    const agents = api();
    const push = vi.spyOn(history, 'pushState');
    render(<Onboarding agents={agents} claudeReady onDone={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Instalar' })[0]);
    expect(agents.connect).toHaveBeenCalledWith('codex');
    expect(takeAgentFocus()).toBe('codex');
    expect(push).toHaveBeenCalledWith(null, '', '/painel#agents');
  });

  it('marks a logged agent as ready and finishes with the CTA', () => {
    const onDone = vi.fn();
    render(<Onboarding agents={api([{ id: 'grok', name: 'Grok', command: 'grok', args: [], status: 'ready' }])} claudeReady onDone={onDone} />);
    expect(screen.getAllByText('pronto')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Começar a conversar' }));
    expect(onDone).toHaveBeenCalled();
  });
});
