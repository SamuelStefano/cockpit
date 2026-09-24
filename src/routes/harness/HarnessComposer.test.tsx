// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HarnessComposer } from './HarnessComposer';
import { useHarnessDraft } from './useHarnessDraft';
import type { HarnessConfig } from '../../../shared/protocol';

const config: HarnessConfig = { hasApiKey: true, nativeModels: [{ id: 'claude-sonnet-5', label: 'Sonnet 5', tier: 'medium' }] };

// The draft lives in the Harness route; tests hold it the same way.
function Composer({ config: c, onRun = () => true }: { config: HarnessConfig; onRun?: () => boolean }) {
  const draft = useHarnessDraft(c);
  return <HarnessComposer config={c} draft={draft} running={false} onRun={onRun} />;
}

const armar = (el: HTMLElement) => fireEvent.click(el.querySelector('[role="switch"]')!);

describe('HarnessComposer · aviso de pentest armado', () => {
  it('não avisa nada com o toggle desligado', () => {
    const { container } = render(<Composer config={config} />);
    expect(container.textContent).toContain('tudo selecionável, nada roda sozinho');
    expect(container.textContent).not.toContain('contexto de pentest ligado');
  });

  // O toggle sobrevive ao "Rodar" (só o prompt é limpo), então o aviso precisa ficar ao
  // lado do botão: é ali que se decide disparar a PRÓXIMA task com o mesmo enquadramento.
  it('avisa ao lado do botão enquanto o toggle está ligado', () => {
    const { container } = render(<Composer config={config} />);
    armar(container);
    expect(container.textContent).toContain('contexto de pentest ligado');
  });

  it('o aviso some ao desligar o toggle', () => {
    const { container } = render(<Composer config={config} />);
    armar(container);
    armar(container);
    expect(container.textContent).not.toContain('contexto de pentest ligado');
  });

  // Bloqueio de configuração tem prioridade: sem chave a task nem roda, e trocar essa
  // mensagem pelo aviso de pentest esconderia o motivo de o botão estar morto.
  it('o bloqueio de configuração tem prioridade sobre o aviso', () => {
    const { container } = render(<Composer config={{ ...config, hasApiKey: false }} />);
    armar(container);
    expect(container.textContent).toContain('ANTHROPIC_API_KEY');
    expect(container.textContent).not.toContain('contexto de pentest ligado');
  });
});

describe('HarnessComposer · prompt kept when nothing went out', () => {
  const type = (el: HTMLElement, v: string) => fireEvent.change(el.querySelector('textarea')!, { target: { value: v } });

  it('keeps the prompt when the run did not go out', () => {
    const { container, getByText } = render(<Composer config={config} onRun={vi.fn(() => false)} />);
    type(container, 'analyse the logs');
    fireEvent.click(getByText('Rodar'));
    expect(container.querySelector('textarea')!.value).toBe('analyse the logs');
  });

  it('clears it once sent', () => {
    const { container, getByText } = render(<Composer config={config} onRun={vi.fn(() => true)} />);
    type(container, 'analyse the logs');
    fireEvent.click(getByText('Rodar'));
    expect(container.querySelector('textarea')!.value).toBe('');
  });
});
