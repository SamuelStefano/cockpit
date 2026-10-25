// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AGENT_PRESETS, type AgentView } from '../../shared/agents';
import { buildCards } from '../cockpit/agents-view';
import type { TermApi } from '../cockpit/useTerminals';
import { typedCommand } from '../cockpit/agent-terminal';

const xterm = vi.hoisted(() => ({ props: null as null | { id: string; onOutput?: (d: string, replay: boolean) => void } }));
vi.mock('../components/Xterm', () => ({
  XtermView: (p: { id: string; onOutput?: (d: string, replay: boolean) => void }) => { xterm.props = p; return <div data-testid="xterm">{p.id}</div>; },
}));

import { AgentPanel } from './AgentPanel';

let mobile = false;
beforeEach(() => {
  mobile = false;
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: mobile, media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); xterm.props = null; vi.unstubAllGlobals(); });

const grok = (items: AgentView[]) => buildCards(AGENT_PRESETS, items).find((c) => c.preset.id === 'grok')!;

function renderPanel(items: AgentView[]) {
  const term = { input: vi.fn(() => true) } as unknown as TermApi & { input: ReturnType<typeof vi.fn> };
  const onConnect = vi.fn();
  const onTest = vi.fn();
  render(
    <AgentPanel
      card={grok(items)} term={term} testing={false} celebrating={false} phrase="" message={undefined}
      onConnect={onConnect} onTest={onTest} onRemove={vi.fn()} onOpenChat={vi.fn()}
    />,
  );
  return { term, onConnect, onTest };
}

describe('AgentPanel — Rodar no terminal', () => {
  it('adds the preset, opens its own terminal, types the install and re-tests when it ends', async () => {
    const { term, onConnect, onTest } = renderPanel([]);
    fireEvent.click(screen.getByRole('button', { name: 'Rodar no terminal' }));
    expect(onConnect).toHaveBeenCalledWith('grok');
    expect((await screen.findByTestId('xterm')).textContent).toMatch('agent-grok');
    expect((screen.getByRole('status')).textContent).toMatch(/testo sozinho/);

    act(() => xterm.props!.onOutput!('$ ', false));
    expect(term.input).toHaveBeenCalledWith('agent-grok', typedCommand('curl -fsSL https://x.ai/cli/install.sh | bash'));
    act(() => xterm.props!.onOutput!('\r\n[deck] passo terminou (0)\r\n', false));
    expect(onTest).toHaveBeenCalledWith('grok');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('on the login step asks to confirm the code and re-tests on "Pronto, já entrei"', async () => {
    const { onConnect, onTest } = renderPanel([{ id: 'grok', name: 'Grok', command: 'grok', args: [], status: 'needs-login', preset: 'grok' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Rodar no terminal' }));
    expect(onConnect).not.toHaveBeenCalled();
    await screen.findByTestId('xterm');
    expect((screen.getByRole('status')).textContent).toMatch(/link ou código/);
    fireEvent.click(screen.getByRole('button', { name: 'Pronto, já entrei' }));
    expect(onTest).toHaveBeenCalledWith('grok');
  });

  it('keeps Copiar as the secondary action', () => {
    renderPanel([]);
    expect(screen.getByRole('button', { name: /Copiar comando: curl/ })).toBeTruthy();
  });

  it('goes full screen with Voltar on a phone', async () => {
    mobile = true;
    renderPanel([]);
    fireEvent.click(screen.getByRole('button', { name: 'Rodar no terminal' }));
    await screen.findByTestId('xterm');
    expect(screen.getByRole('region', { name: 'Terminal do Grok' }).className).toMatch(/fixed inset-0/);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByTestId('xterm')).toBeNull();
  });
});
