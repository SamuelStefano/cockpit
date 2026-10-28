// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import { TrafficMarker } from './TrafficMarker';

const bot = (id: string, name: string): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0 });
const byId = new Map([bot('pesq1', 'Pesquisador'), bot('redat', 'Redator'), bot('revis', 'Revisor')].map((b) => [b.id, b]));
const m = (id: string, from: string, to: string, over: Partial<TeamMessage> = {}): TeamMessage => ({ id, from, to, text: `texto ${id}`, ts: 1, status: 'delivered', hop: 1, ...over });
const group = (items: TeamMessage[]) => ({ key: 'g', ts: 1, items, peers: [] });

afterEach(cleanup);

describe('TrafficMarker', () => {
  it('is a pill naming who talked and expands inline, never navigating', () => {
    render(<TrafficMarker group={group([m('a', 'pesq1', 'redat'), m('b', 'redat', 'pesq1'), m('c', 'pesq1', 'redat')])} byId={byId} />);
    const pill = screen.getByRole('button', { name: /3 mensagens entre Pesquisador e Redator/ });
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('texto a')).toBeNull();
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    ['texto a', 'texto b', 'texto c'].forEach((t) => expect(screen.getByText(t)).toBeTruthy());
    fireEvent.click(pill);
    expect(screen.queryByText('texto a')).toBeNull();
  });

  it('uses the singular for one message and flags a blocked one once open', () => {
    render(<TrafficMarker group={group([m('a', 'redat', 'revis', { status: 'blocked', reason: 'equipe pausada' })])} byId={byId} />);
    fireEvent.click(screen.getByRole('button', { name: /1 mensagem entre Redator e Revisor/ }));
    expect(screen.getByText('bloqueada').getAttribute('title')).toBe('equipe pausada');
  });

  it('lets you quote a message from the opened pill', () => {
    const onQuote = vi.fn();
    render(<TrafficMarker group={group([m('a', 'pesq1', 'redat')])} byId={byId} onQuote={onQuote} />);
    fireEvent.click(screen.getByRole('button', { name: /1 mensagem/ }));
    fireEvent.click(screen.getByRole('button', { name: /citar/i }));
    expect(onQuote).toHaveBeenCalledWith('texto a');
  });
});
