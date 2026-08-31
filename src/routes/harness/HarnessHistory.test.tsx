// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HarnessHistory } from './HarnessHistory';
import type { HarnessTaskView } from '../../../shared/protocol';

const task = (over: Partial<HarnessTaskView> = {}): HarnessTaskView => ({
  id: 't1', ts: Date.now(), prompt: 'auditar o login', context: null, mode: 'auto',
  tier: 'medium', tierReason: '', model: 'claude-sonnet-5', status: 'done', ...over,
});

const marcas = (el: HTMLElement) => el.querySelectorAll('[title="Rodou com o contexto de pentest autorizado"]');

describe('HarnessHistory · contexto de pentest', () => {
  // No histórico é o único lugar onde dá pra separar, meses depois, o que rodou sob o
  // enquadramento de segurança do que rodou como task comum.
  it('marca só a linha que rodou com o contexto', () => {
    const { container } = render(
      <HarnessHistory tasks={[task({ id: 'a', context: 'pentest' }), task({ id: 'b' })]} />,
    );
    expect(marcas(container).length).toBe(1);
  });

  it('não marca nada quando nenhuma task usou o contexto', () => {
    const { container } = render(<HarnessHistory tasks={[task({ id: 'a' }), task({ id: 'b' })]} />);
    expect(marcas(container).length).toBe(0);
  });

  it('esconde a task ativa e mantém a marca das demais', () => {
    const { container } = render(
      <HarnessHistory tasks={[task({ id: 'a', context: 'pentest' }), task({ id: 'b', context: 'pentest' })]} activeId="a" />,
    );
    expect(marcas(container).length).toBe(1);
  });
});
