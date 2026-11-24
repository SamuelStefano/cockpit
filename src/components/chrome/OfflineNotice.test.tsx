// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { OfflineNotice, backendHost, diagnosticLine } from './OfflineNotice';
import { recordClose, resetTelemetryForTests } from '../../app/connectionTelemetry';
import { AGENT_COMMANDS } from '../../app/diag/connectionCause';

vi.mock('../primitives/CodeBlock', () => ({ CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre> }));

afterEach(() => { cleanup(); resetTelemetryForTests(); });

const BOX = { id: '3f2a9c1e-0000-4000-8000-000000000001', label: 'tainan-box', online: false, lastSeen: '2026-10-27T13:05:00Z' };

describe('OfflineNotice', () => {
  it('names the backend host the socket dials, not the page host', () => {
    expect(backendHost('wss://vps.tailnet.ts.net/ws')).toBe('vps.tailnet.ts.net');
    expect(backendHost('ws://127.0.0.1:7777/ws')).toBe('127.0.0.1:7777');
  });

  it('"Reconectar agora" triggers the forced reconnect and shows progress', () => {
    const trigger = vi.fn();
    const { getByText, rerender } = render(<OfflineNotice show reconnect={{ status: 'idle', trigger }} />);
    fireEvent.click(getByText('Reconectar agora'));
    expect(trigger).toHaveBeenCalledOnce();
    rerender(<OfflineNotice show reconnect={{ status: 'trying', trigger }} />);
    expect(getByText('Reconectando…')).toBeTruthy();
    rerender(<OfflineNotice show cause="relay-unreachable" reconnect={{ status: 'failed', trigger }} />);
    expect(getByText(/^Ainda sem conexão/)).toBeTruthy();
  });

  it('says the login was refused after a 4401, not that the server is down', () => {
    const { getByText, queryByText } = render(<OfflineNotice show cause="login-refused" />);
    expect(getByText('Seu login não foi aceito')).toBeTruthy();
    expect(queryByText(/fora do alcance/)).toBeNull();
    expect(queryByText('Configurar endereço do backend')).toBeNull();
  });

  it('shows an offline box with its name and the commands to bring the agent back', () => {
    const { getByText, container } = render(<OfflineNotice show cause="box-offline" box={BOX} />);
    expect(getByText('A máquina tainan-box está offline')).toBeTruthy();
    expect(getByText(/^Sem sinal dela desde /)).toBeTruthy();
    for (const c of Object.values(AGENT_COMMANDS)) expect(container.textContent).toContain(c);
  });

  it('never shows the old vague "Backend não acessível"', () => {
    const { queryByText } = render(<OfflineNotice show />);
    expect(queryByText('Backend não acessível')).toBeNull();
    expect(queryByText('Servidor do Deck fora do alcance')).toBeTruthy();
  });

  it('formats the diagnostic line', () => {
    expect(diagnosticLine(1006, 1000, 43_000)).toBe('código 1006 · offline há 42 s');
    expect(diagnosticLine(1006, null)).toBe('código 1006');
    expect(diagnosticLine(undefined, 1000)).toBeNull();
  });

  it('shows the diagnostic only when a close code is known', () => {
    const { queryByText, rerender } = render(<OfflineNotice show offlineSince={Date.now() - 42_000} />);
    expect(queryByText(/^código/)).toBeNull();
    recordClose(1006, '');
    rerender(<OfflineNotice show offlineSince={Date.now() - 42_000} />);
    expect(queryByText(/^código 1006 · offline há 4\d s$/)).toBeTruthy();
  });
});
