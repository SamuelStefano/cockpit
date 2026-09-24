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
