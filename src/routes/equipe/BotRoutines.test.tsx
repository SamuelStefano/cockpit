// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cron } from '../../../shared/protocol';
import { BotRoutines } from './BotRoutines';
import { emptyRoutineDraft, type BotRoutines as Routines } from './useBotRoutines';

const routine: Cron = { id: 'r1', name: 'métricas', prompt: 'puxe', schedule: { kind: 'interval', everyMinutes: 5 }, enabled: true, createdAt: 0, lastRun: 0, botId: 'capo1' };
const api = (over: Partial<Routines> = {}): Routines => ({
  routines: [], now: 0, draft: null, error: null, set: vi.fn(), open: vi.fn(), cancel: vi.fn(), submit: vi.fn(),
  toggle: vi.fn(), run: vi.fn(), remove: vi.fn(), ...over,
});

describe('BotRoutines', () => {
  it('explains routines when the bot has none and opens the form', () => {
    const r = api();
    render(<BotRoutines r={r} />);
    expect(screen.getByText('Rotinas são tarefas recorrentes deste bot.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nova rotina' }));
    expect(r.open).toHaveBeenCalled();
  });

  it('lists a routine with its schedule, next fire and actions', () => {
    const r = api({ routines: [routine] });
    render(<BotRoutines r={r} />);
    expect(screen.getByText('a cada 5 min · próxima em 5min')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch'));
    expect(r.toggle).toHaveBeenCalledWith(routine);
    fireEvent.click(screen.getByRole('button', { name: 'Rodar agora' }));
    expect(r.run).toHaveBeenCalledWith('r1');
    fireEvent.click(screen.getByRole('button', { name: 'Apagar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'apagar?' }));
    expect(r.remove).toHaveBeenCalledWith('r1');
  });

  it('shows the paused state on the switch', () => {
    render(<BotRoutines r={api({ routines: [{ ...routine, enabled: false }] })} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('a cada 5 min · pausada')).toBeTruthy();
  });

  it('blocks creating while the draft has an error', () => {
    const r = api({ draft: emptyRoutineDraft(), error: 'dê um nome à rotina' });
    render(<BotRoutines r={r} />);
    expect(screen.getByText('dê um nome à rotina')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Criar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
