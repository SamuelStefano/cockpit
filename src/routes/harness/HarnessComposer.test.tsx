// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HarnessComposer } from './HarnessComposer';
import type { HarnessConfig } from '../../../shared/protocol';

const config: HarnessConfig = { hasApiKey: true, nativeModels: [{ id: 'claude-sonnet-5', label: 'Sonnet 5', tier: 'medium' }] };

const armar = (el: HTMLElement) => fireEvent.click(el.querySelector('[role="switch"]')!);

describe('HarnessComposer · aviso de pentest armado', () => {
  it('não avisa nada com o toggle desligado', () => {
    const { container } = render(<HarnessComposer config={config} running={false} onRun={() => {}} />);
    expect(container.textContent).toContain('tudo selecionável, nada roda sozinho');
    expect(container.textContent).not.toContain('contexto de pentest ligado');
  });

  // O toggle sobrevive ao "Rodar" (só o prompt é limpo), então o aviso precisa ficar ao
  // lado do botão: é ali que se decide disparar a PRÓXIMA task com o mesmo enquadramento.
  it('avisa ao lado do botão enquanto o toggle está ligado', () => {
    const { container } = render(<HarnessComposer config={config} running={false} onRun={() => {}} />);
    armar(container);
    expect(container.textContent).toContain('contexto de pentest ligado');
  });

  it('o aviso some ao desligar o toggle', () => {
    const { container } = render(<HarnessComposer config={config} running={false} onRun={() => {}} />);
    armar(container);
    armar(container);
    expect(container.textContent).not.toContain('contexto de pentest ligado');
  });

  // Bloqueio de configuração tem prioridade: sem chave a task nem roda, e trocar essa
  // mensagem pelo aviso de pentest esconderia o motivo de o botão estar morto.
  it('o bloqueio de configuração tem prioridade sobre o aviso', () => {
    const { container } = render(<HarnessComposer config={{ ...config, hasApiKey: false }} running={false} onRun={() => {}} />);
    armar(container);
    expect(container.textContent).toContain('ANTHROPIC_API_KEY');
    expect(container.textContent).not.toContain('contexto de pentest ligado');
  });
});
