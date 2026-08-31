// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HarnessFeed } from './HarnessFeed';
import type { HarnessTaskView } from '../../../shared/protocol';

const task = (over: Partial<HarnessTaskView> = {}): HarnessTaskView => ({
  id: 't1', ts: 1_000, prompt: 'auditar o login', context: null, mode: 'auto',
  tier: 'medium', tierReason: '', model: 'claude-sonnet-5', status: 'done',
  resultText: 'resposta', ...over,
});

describe('HarnessFeed · contexto de pentest', () => {
  // O campo já vinha do servidor e era persistido, mas nenhuma tela lia: depois que a
  // task terminava não havia como saber sob qual system prompt ela rodou.
  it('anuncia a task que rodou com contexto de pentest', () => {
    const { container } = render(<HarnessFeed task={task({ context: 'pentest' })} events={[]} />);
    expect(container.textContent).toContain('pentest');
    expect(container.textContent).toContain('contexto de pentest autorizado no system prompt');
  });

  it('não inventa o aviso na task comum', () => {
    const { container } = render(<HarnessFeed task={task()} events={[]} />);
    expect(container.textContent).not.toContain('pentest');
  });

  it('marca também a task ainda em execução', () => {
    const { container } = render(<HarnessFeed task={task({ context: 'pentest', status: 'running' })} events={[]} />);
    expect(container.textContent).toContain('pentest');
  });
});
