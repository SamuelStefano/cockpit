// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Crons } from './Crons';

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
