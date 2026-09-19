// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { SessionUsage } from '../../../shared/protocol';
import { UsageRow } from './UsageRow';

const row: SessionUsage = {
  sessionId: 's1', ctxTokens: 1000, outputTokens: 10, samples: 1, lastTs: Date.now(), model: null, costUsd: 1,
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
