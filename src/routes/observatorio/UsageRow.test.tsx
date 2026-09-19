// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { SessionUsage } from '../../../shared/protocol';
import { UsageRow } from './UsageRow';

const row: SessionUsage = {
  sessionId: 's1', ctxTokens: 1000, outputTokens: 10, samples: 1, lastTs: Date.now(), model: null, requestedModel: null, costUsd: 1,
};

const mount = (openable: boolean, onOpen: () => void) =>
  render(<table><tbody><UsageRow row={row} maxOut={100} title="sessão" openable={openable} onOpen={onOpen} /></tbody></table>);

describe('UsageRow', () => {
  it('abre a sessão pelo teclado, não só pelo clique', () => {
    const onOpen = vi.fn();
    const { container } = mount(true, onOpen);
    const tr = container.querySelector('tr')!;
    expect(tr.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(tr, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('linha sem sessão conhecida fica fora da navegação', () => {
    const { container } = mount(false, vi.fn());
    expect(container.querySelector('tr')!.getAttribute('tabindex')).toBeNull();
  });
});

// Regressão: uma sessão `[1m]` media 210k sobre 200k e aparecia 100% vermelha
// com o selo "contexto quase cheio" — em 1M isso é 21%.
describe('UsageRow — janela do modelo', () => {
  const long: SessionUsage = { ...row, ctxTokens: 210_000, requestedModel: 'claude-opus-5[1m]' };
  const short: SessionUsage = { ...row, ctxTokens: 210_000, requestedModel: 'claude-opus-5' };
  const mountRow = (r: SessionUsage) =>
    render(<table><tbody><UsageRow row={r} maxOut={100} title="sessão" openable={false} onOpen={() => {}} /></tbody></table>);

  it('não marca contexto quase cheio numa sessão de 1M', () => {
    const { container } = mountRow(long);
    expect(container.textContent).not.toContain('100%');
    expect(container.querySelector('[title*="quase cheio"]')).toBeNull();
  });

  it('continua marcando a sessão de 200k', () => {
    const { container } = mountRow(short);
    expect(container.querySelector('[title*="quase cheio"]')).not.toBeNull();
  });
});
