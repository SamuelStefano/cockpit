// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamState } from '../../../shared/team-state';
import { EquipeHome } from './EquipeHome';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const NOW = 10_000_000_000;
const state: TeamState = {
  at: NOW, followUpHours: 4, handoffs: [],
  followUps: [{ from: 'a', to: 'r', at: NOW - 5 * 3_600_000, preview: 'secret preview' }],
  bots: [
    { id: 'a', name: 'Anderson', role: 'TL Itera', status: 'waiting', task: 'Esperando revisão da Raquel' },
    { id: 'z', name: 'Zoro', role: 'CTO', status: 'working', task: 'Redesenho do Deck' },
    { id: 'r', name: 'Raquel', role: 'Revisão', status: 'idle' },
  ],
};
const bot = (id: string, extra: Partial<TeamBot> = {}) => ({ id, name: id, sessionId: `s-${id}`, ...extra } as TeamBot);
const bots = [bot('a', { primary: true }), bot('z'), bot('r')];

function mount(over: Partial<Parameters<typeof EquipeHome>[0]> = {}) {
  const p = { state, bots, connected: true, onLoad: vi.fn(), onOpenAgent: vi.fn(), onSendTo: vi.fn(() => true), now: NOW, ...over };
  render(<EquipeHome {...p} />);
  return p;
}

describe('EquipeHome', () => {
  it('requests the snapshot and renders counts, banner and sections', () => {
    const p = mount();
    expect(p.onLoad).toHaveBeenCalled();
    expect(screen.getByText('1 trabalhando')).toBeTruthy();
    expect(screen.getByText('3 bots')).toBeTruthy();
    expect(screen.getByText('1 pedido sem resposta')).toBeTruthy();
    expect(screen.getByText('Anderson → Raquel há 5 h')).toBeTruthy();
    expect(screen.getByText('Precisam de você')).toBeTruthy();
    expect(screen.getByText('Trabalhando agora')).toBeTruthy();
    expect(screen.getByText('Redesenho do Deck')).toBeTruthy();
  });
  it('Cobrar sends to the bot that owes the answer', () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    expect(p.onSendTo).toHaveBeenCalledWith('s-r', expect.stringContaining('Anderson aguarda'));
  });
  it('Cobrar is disabled with a tooltip when the target has no session', () => {
    const p = mount({ bots: [bot('a', { primary: true }), bot('z'), bot('r', { sessionId: undefined })] });
    const btn = screen.getByRole('button', { name: 'Cobrar' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toBe('bot sem sessão');
    fireEvent.click(btn);
    expect(p.onSendTo).not.toHaveBeenCalled();
  });
  it('shows "não enviado" when the nudge is rejected', () => {
    mount({ onSendTo: vi.fn(() => false) });
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    expect(screen.getByText('não enviado')).toBeTruthy();
  });
  it('hints and disables the composer when the primary bot has no session', () => {
    mount({ bots: [bot('a', { primary: true, sessionId: undefined }), bot('z'), bot('r')] });
    fireEvent.change(screen.getByLabelText('Pedir algo para a equipe'), { target: { value: 'oi' } });
    expect(screen.getByText('bot principal sem sessão')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('the composer sends to the primary bot', () => {
    const p = mount();
    fireEvent.change(screen.getByLabelText('Pedir algo para a equipe'), { target: { value: 'Priorize o Deck' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(p.onSendTo).toHaveBeenCalledWith('s-a', 'Priorize o Deck');
  });
  it('recording mode hides task text and persists', () => {
    mount();
    fireEvent.click(screen.getByRole('switch', { name: 'Modo gravação' }));
    expect(screen.queryByText('Redesenho do Deck')).toBeNull();
    expect(screen.getByText('Trabalhando')).toBeTruthy();
    expect(screen.getByText('Zoro')).toBeTruthy();
    expect(JSON.stringify(localStorage)).toContain('team.recordingMode');
  });
  it('opens the bot chat on card click', () => {
    const p = mount();
    fireEvent.click(screen.getByText('Zoro'));
    expect(p.onOpenAgent).toHaveBeenCalledWith('z');
  });
});
