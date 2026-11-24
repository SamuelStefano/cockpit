// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Cron, TeamBot } from '../../../../shared/protocol';
import { NewRoutine } from './NewRoutine';

afterEach(cleanup);
const brt = (y: number, mo: number, d: number, h: number) => Date.UTC(y, mo - 1, d, h + 3);
const NOW = brt(2026, 10, 28, 12);
const bot = (id: string, name: string, primary = false): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'blob', color: '#6cf' }, profile: 'full', primary, createdAt: 0, updatedAt: 0 });
const BOTS = [bot('g', 'Growth'), bot('l', 'Lia', true)];

function setup(extra: Partial<React.ComponentProps<typeof NewRoutine>> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(<NewRoutine bots={BOTS} now={NOW} onClose={onClose} onSubmit={onSubmit} {...extra} />);
  return { onSubmit, onClose };
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('NewRoutine', () => {
  it('starts with the primary agent picked and the create button off', () => {
    setup();
    expect(screen.getByRole('radio', { name: 'Lia' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('button', { name: 'Criar rotina' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows what it understood in words, the next day, and the raw cron under Detalhes', () => {
    setup();
    type('Quando', 'toda segunda às 8h');
    expect(screen.getByText('segundas, 08:00')).toBeTruthy();
    expect(screen.getByText(/próxima: 2 nov · horário de Brasília/)).toBeTruthy();
    expect(screen.getByText('0 8 * * 1')).toBeTruthy();
    expect(screen.getByText(/Próximas 3: seg, 2 nov 08:00 · seg, 9 nov 08:00 · seg, 16 nov 08:00/)).toBeTruthy();
  });

  it('says it did not understand and blocks the button', () => {
    setup();
    type('O que fazer', 'revisar');
    type('Quando', 'quando der vontade');
    expect(screen.getByText("Não entendi — tente 'toda sexta às 17h'")).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Criar rotina' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('accepts a raw cron expression', () => {
    setup();
    type('Quando', '0 9 * * 1-5');
    expect(screen.getByText('dias úteis, 09:00')).toBeTruthy();
  });

  it('submits agent, prompt, parsed schedule and the retry choice', () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Growth' }));
    type('O que fazer', 'Revisar o calendário');
    type('Quando', 'todo dia útil às 9h');
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar rotina' }));
    expect(onSubmit).toHaveBeenCalledWith({
      botId: 'g', prompt: 'Revisar o calendário', retry: true,
      schedule: { kind: 'daily', atMinute: 540, weekdays: [1, 2, 3, 4, 5] },
    });
  });

  it('editing prefills the schedule as words and keeps the retry flag', () => {
    const c: Cron = { id: 'r', name: 'n', prompt: 'faz', schedule: { kind: 'daily', atMinute: 870, weekdays: [1] }, enabled: true, createdAt: 0, botId: 'g', retry: true };
    setup({ editing: c });
    expect((screen.getByLabelText('Quando') as HTMLInputElement).value).toBe('toda segunda às 14h30');
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'Salvar rotina' })).toBeTruthy();
  });

  it('with a fixed agent hides the picker', () => {
    setup({ fixedBotId: 'g' });
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('Cancelar closes', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
