// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Crons, canToggleOn } from './Crons';

const props = {
  crons: [],
  loaded: false,
  onCronsGet: vi.fn(),
  onCronSave: vi.fn(),
  onCronDelete: vi.fn(),
  onCronRun: vi.fn(),
  models: [],
};

describe('Crons', () => {
  it('desconectado não promete lista vazia nem oferece o formulário', () => {
    const { container } = render(<Crons {...props} connected={false} />);
    expect(container.textContent).toContain('Desconectado');
    expect(container.textContent).not.toContain('Nenhum cron');
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('conectado e sem crons mostra o vazio de verdade', () => {
    const { container } = render(<Crons {...props} connected loaded crons={[]} />);
    expect(container.textContent).toContain('Nenhum cron');
  });
});

describe('canToggleOn', () => {
  const base = { id: 'c', name: 'n', prompt: 'p', createdAt: 0 };
  it('always lets you pause, and re-enable a recurring cron', () => {
    expect(canToggleOn({ ...base, enabled: true, schedule: { kind: 'once', atMs: 1 } } as never, 10)).toBe(true);
    expect(canToggleOn({ ...base, enabled: false, schedule: { kind: 'daily', time: '09:00' } } as never, 10)).toBe(true);
  });
  it('does not re-enable a one-time cron whose moment already passed', () => {
    expect(canToggleOn({ ...base, enabled: false, schedule: { kind: 'once', atMs: 5 } } as never, 10)).toBe(false);
    expect(canToggleOn({ ...base, enabled: false, schedule: { kind: 'once', atMs: 50 } } as never, 10)).toBe(true);
  });
});

describe('Crons with bot routines', () => {
  const bot = { id: 'capo1', name: 'capo', label: '', instructions: '', mascot: { shape: 'drop' as const, color: '#22c55e' }, profile: 'full' as const, createdAt: 0, updatedAt: 0 };
  const routine = { id: 'r1', name: 'métricas', prompt: 'p', schedule: { kind: 'interval' as const, everyMinutes: 5 }, enabled: true, createdAt: 0, botId: 'capo1' };

  it('names the bot that owns the routine and loads the team', () => {
    const onTeamGet = vi.fn();
    const { getByLabelText } = render(<Crons {...props} connected loaded crons={[routine]} bots={[bot]} onTeamGet={onTeamGet} />);
    expect(getByLabelText(/capo/)).toBeTruthy();
    expect(onTeamGet).toHaveBeenCalled();
  });

  it('marks a routine whose bot was removed', () => {
    const { container } = render(<Crons {...props} connected loaded crons={[{ ...routine, enabled: false }]} bots={[]} onTeamGet={vi.fn()} />);
    expect(container.textContent).toContain('bot removido');
  });

  it('does not ask for the team when no cron belongs to a bot', () => {
    const onTeamGet = vi.fn();
    render(<Crons {...props} connected loaded crons={[{ ...routine, botId: undefined }]} onTeamGet={onTeamGet} />);
    expect(onTeamGet).not.toHaveBeenCalled();
  });
});
