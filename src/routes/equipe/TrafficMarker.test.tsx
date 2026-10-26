// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import { TrafficMarker } from './TrafficMarker';

const bot = (id: string, name: string): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0 });
const byId = new Map([bot('lead1', 'growth-lead'), bot('ativ1', 'growth-ativacao'), bot('aqui1', 'growth-aquisicao')].map((b) => [b.id, b]));
const m = (id: string, from: string, to: string, over: Partial<TeamMessage> = {}): TeamMessage => ({ id, from, to, text: `texto ${id}`, ts: 1, status: 'delivered', hop: 1, ...over });

describe('TrafficMarker', () => {
  it('shows one sent message as a "Mandou para" chip that opens the pair thread', () => {
    const onOpen = vi.fn();
    render(<TrafficMarker group={{ key: 'a', ts: 1, items: [m('a', 'lead1', 'ativ1')], peers: ['ativ1'] }} botId="lead1" byId={byId} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Mandou para.*growth-ativacao/ }));
    expect(onOpen).toHaveBeenCalledWith('ativ1');
  });

  it('shows one received message as "Mensagem de" and flags a blocked one', () => {
    render(<TrafficMarker group={{ key: 'a', ts: 1, items: [m('a', 'ativ1', 'lead1', { status: 'blocked', reason: 'equipe pausada' })], peers: ['ativ1'] }} botId="lead1" byId={byId} onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Mensagem de.*growth-ativacao/ })).toBeTruthy();
    expect(screen.getByText('bloqueada').getAttribute('title')).toBe('equipe pausada');
  });

  it('lets you peek a single message without leaving the thread', () => {
    render(<TrafficMarker group={{ key: 'a', ts: 1, items: [m('a', 'lead1', 'ativ1')], peers: ['ativ1'] }} botId="lead1" byId={byId} onOpen={vi.fn()} />);
    expect(screen.getByText('texto a')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mensagem' }));
    expect(screen.getByText('texto a')).toBeTruthy();
  });

  it('collapses a run into "N mensagens com A e B", each name opening its thread', () => {
    const onOpen = vi.fn();
    const items = [m('a', 'lead1', 'ativ1'), m('b', 'aqui1', 'lead1')];
    render(<TrafficMarker group={{ key: 'a', ts: 1, items, peers: ['ativ1', 'aqui1'] }} botId="lead1" byId={byId} onOpen={onOpen} />);
    expect(screen.getByText('2 mensagens com')).toBeTruthy();
    expect(screen.getByText('e')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversa com growth-aquisicao' }));
    expect(onOpen).toHaveBeenCalledWith('aqui1');
    fireEvent.click(screen.getByRole('button', { name: 'Ver mensagens' }));
    expect(screen.getByText('texto a')).toBeTruthy();
    expect(screen.getByText('texto b')).toBeTruthy();
  });
});
