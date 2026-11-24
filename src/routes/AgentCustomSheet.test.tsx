// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentsApi } from '../cockpit/useAgents';
import type { TermApi } from '../cockpit/useTerminals';

vi.mock('../components/Xterm', () => ({ XtermView: () => <div data-testid="xterm" /> }));

import { AgentCustomSheet } from './AgentCustomSheet';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function makeAgents(over: Partial<AgentsApi> = {}): AgentsApi {
  return {
    items: [], presets: [], customAllowed: true, loaded: true, testing: new Set(), lastTest: null,
    refresh: vi.fn(), connect: vi.fn(), test: vi.fn(), remove: vi.fn(),
    addCustom: vi.fn(() => true), probeDraft: vi.fn(() => true), customBusy: null, customOutcome: null, clearCustomOutcome: vi.fn(),
    versions: { id: null, items: [], loading: false, diff: null, restoring: false, open: vi.fn(), close: vi.fn(), showDiff: vi.fn(), restore: vi.fn() },
    ...over,
  };
}

const term = { input: vi.fn(() => true) } as unknown as TermApi;
const fill = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

describe('AgentCustomSheet', () => {
  it('locks the form for a non-root admin and says why', () => {
    const agents = makeAgents();
    render(<AgentCustomSheet agents={agents} gate={{ allowed: false, reason: 'Só a conta root salva agente novo.' }} term={term} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('note').textContent).toMatch(/root/);
    expect(screen.getByPlaceholderText('Meu agente').matches(':disabled')).toBe(true);
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('builds the draft from the form: slug id, argv split, optional setup commands', () => {
    const agents = makeAgents();
    render(<AgentCustomSheet agents={agents} gate={{ allowed: true }} term={term} onClose={vi.fn()} onSaved={vi.fn()} />);
    fill('Meu agente', 'Gemini Pro');
    fill('gemini --experimental-acp', 'gemini --experimental-acp');
    fill('npm install -g meu-cli', 'npm install -g @google/gemini-cli');
    fireEvent.click(screen.getByRole('button', { name: 'Testar antes de salvar' }));
    expect(agents.probeDraft).toHaveBeenCalledWith({
      id: 'gemini-pro', name: 'Gemini Pro', command: 'gemini', args: ['--experimental-acp'], install: 'npm install -g @google/gemini-cli',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(agents.addCustom).toHaveBeenCalledTimes(1);
  });

  it('shows a server refusal under the field it is about', () => {
    const agents = makeAgents({ customOutcome: { kind: 'save', ok: false, field: 'command', message: '`x` não está instalado nesta VPS' } });
    render(<AgentCustomSheet agents={agents} gate={{ allowed: true }} term={term} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toMatch(/não está instalado/);
  });

  it('runs the install command in the new agent terminal before saving', async () => {
    const agents = makeAgents();
    render(<AgentCustomSheet agents={agents} gate={{ allowed: true }} term={term} onClose={vi.fn()} onSaved={vi.fn()} />);
    fill('npm install -g meu-cli', 'npm install -g x');
    fireEvent.click(screen.getByRole('button', { name: 'Rodar' }));
    expect(await screen.findByTestId('xterm')).toBeTruthy();
  });
});
