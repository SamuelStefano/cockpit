// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import type { Cron, TeamBot } from '../../../../shared/protocol';
import { Rotinas } from '../Rotinas';
import { BotRoutines } from '../BotRoutines';
import type { Rotinas as RotinasState } from './useRotinas';
import { historyOf } from './routine-view';

afterEach(cleanup);
const brt = (y: number, mo: number, d: number, h: number) => Date.UTC(y, mo - 1, d, h + 3);
const NOW = brt(2026, 10, 28, 12);
const bot = (id: string, name: string): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'blob', color: '#6cf' }, profile: 'full', createdAt: 0, updatedAt: 0 });
const BOTS = [bot('g', 'Growth')];
const ok: Cron = { id: 'a', name: 'Rodada de growth', prompt: 'pede métricas', schedule: { kind: 'daily', atMinute: 540, weekdays: [1, 2, 3, 4, 5] }, enabled: true, createdAt: 0, botId: 'g', lastRun: brt(2026, 10, 28, 9), lastFire: 'started' };
const bad: Cron = { id: 'b', name: 'Fechar o dia', prompt: 'resume', schedule: { kind: 'daily', atMinute: 1080, weekdays: [1, 2, 3, 4, 5] }, enabled: true, createdAt: 0, botId: 'g', lastRun: brt(2026, 10, 27, 18), lastFire: 'bot-busy', retry: true, retryAt: brt(2026, 10, 28, 19) };

const state = (routines: Cron[], over: Partial<RotinasState> = {}): RotinasState => ({
  bots: BOTS, routines, history: historyOf(routines, NOW), now: NOW, modal: null, openNew: vi.fn(), openEdit: vi.fn(), close: vi.fn(), save: vi.fn(),
  toggle: vi.fn(), run: vi.fn(), remove: vi.fn(), ...over,
});
const page = (r: RotinasState, props: Partial<React.ComponentProps<typeof Rotinas>> = {}) =>
  render(<Rotinas r={r} bots={BOTS} loaded connected isAdmin onChat={vi.fn()} onReload={vi.fn()} {...props} />);

describe('Rotinas page', () => {
  it('shows next, failure and week cards, a table and the history', () => {
    page(state([ok, bad]));
    const cards = within(screen.getByLabelText('Resumo'));
    expect(cards.getByText('Próxima: Fechar o dia · 18:00')).toBeTruthy();
    expect(cards.getByText('1 falha ontem')).toBeTruthy();
    expect(cards.getByText('Esta semana')).toBeTruthy();
    expect(screen.getAllByText('Todo dia útil às 9h').length).toBe(1);
    expect(screen.getByText('ontem 18:00 · falhou')).toBeTruthy();
    expect(screen.getByText('Histórico')).toBeTruthy();
    expect(screen.getByText('falhou · o agente estava ocupado')).toBeTruthy();
  });

  it('history: Ver conversa per run and Rodar agora on a failure', () => {
    const onChat = vi.fn();
    const r = state([ok, bad]);
    page(r, { onChat });
    expect(screen.getAllByRole('button', { name: 'Ver conversa' }).length).toBe(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver conversa' })[0]);
    expect(onChat).toHaveBeenCalledWith('g');
    fireEvent.click(screen.getByRole('button', { name: 'Rodar agora' }));
    expect(r.run).toHaveBeenCalledWith('b');
  });

  it('toggles a routine from its switch', () => {
    const r = state([ok]);
    page(r);
    fireEvent.click(screen.getByRole('switch', { name: 'Rodada de growth' }));
    expect(r.toggle).toHaveBeenCalledWith(ok);
  });

  it('row menu: run now, edit, see conversation, two-step delete', () => {
    const onChat = vi.fn();
    const r = state([ok]);
    page(r, { onChat });
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Mais ações de Rodada de growth' }));
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rodar agora' }));
    expect(r.run).toHaveBeenCalledWith('a');
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(r.openEdit).toHaveBeenCalledWith(ok);
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver conversa' }));
    expect(onChat).toHaveBeenCalledWith('g');
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apagar' }));
    expect(r.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apagar mesmo?' }));
    expect(r.remove).toHaveBeenCalledWith('a');
  });

  it('empty state offers a new routine to admins only', () => {
    const r = state([]);
    page(r);
    fireEvent.click(screen.getByRole('button', { name: /Nova rotina/ }));
    expect(r.openNew).toHaveBeenCalled();
    cleanup();
    page(state([]), { isAdmin: false });
    expect(screen.queryByRole('button', { name: /Nova rotina/ })).toBeNull();
  });

  it('opens the new-routine modal when the hook says so', () => {
    page(state([ok], { modal: {} }));
    expect(screen.getByRole('dialog', { name: 'Nova rotina' })).toBeTruthy();
  });
});

describe('BotRoutines (agent tab)', () => {
  it('lists the routines in the new look with the explain row and opens the modal', () => {
    const r = state([ok, bad]);
    render(<BotRoutines botId="g" r={r} onChat={vi.fn()} />);
    expect(screen.getAllByText('Rodada de growth').length).toBeGreaterThan(0);
    expect(screen.getByText('pede métricas')).toBeTruthy();
    expect(screen.getByText(/Nova rotina — descreva em palavras/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nova rotina' }));
    expect(r.openNew).toHaveBeenCalled();
  });
  it('a failed routine offers to run again inline', () => {
    const r = state([bad]);
    render(<BotRoutines botId="g" r={r} onChat={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Rodar de novo' })[0]);
    expect(r.run).toHaveBeenCalledWith('b');
  });
  it('explains routines when the agent has none', () => {
    render(<BotRoutines botId="g" r={state([])} onChat={vi.fn()} />);
    expect(screen.getByText(/Rotinas são tarefas que este agente faz sozinho/)).toBeTruthy();
  });
});
