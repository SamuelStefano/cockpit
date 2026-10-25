// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import { PeerThread } from './PeerThread';

const bot = (id: string, name: string): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0 });
const a = bot('lead1', 'growth-lead');
const b = bot('ativ1', 'growth-ativacao');
const c = bot('conv1', 'growth-conversao');
const byId = new Map([a, b, c].map((x) => [x.id, x]));
const m = (id: string, from: string, to: string, over: Partial<TeamMessage> = {}): TeamMessage => ({ id, from, to, text: `texto ${id}`, ts: 1, status: 'delivered', hop: 1, ...over });

describe('PeerThread', () => {
  it('shows only the pair, with the sender name on each bubble, read-only', () => {
    const log = [m('m1', 'lead1', 'ativ1'), m('m2', 'lead1', 'conv1'), m('m3', 'ativ1', 'lead1', { status: 'queued' })];
    render(<PeerThread a={a} b={b} log={log} byId={byId} onBack={vi.fn()} />);
    expect(screen.getByRole('log', { name: 'Conversa entre growth-lead e growth-ativacao' })).toBeTruthy();
    expect(screen.getByText('texto m1')).toBeTruthy();
    expect(screen.getByText('texto m3')).toBeTruthy();
    expect(screen.queryByText('texto m2')).toBeNull();
    expect(screen.getByText('na fila')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('goes back to the bot thread', () => {
    const onBack = vi.fn();
    render(<PeerThread a={a} b={b} log={[]} byId={byId} onBack={onBack} />);
    expect(screen.getByText('Sem mensagens')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar pra growth-lead' }));
    expect(onBack).toHaveBeenCalled();
  });
});
