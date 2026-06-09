// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { LiveStatsLine, fmtTokensK } from './Thinking';

describe('fmtTokensK', () => {
  it('formata compacto (cru, k, M)', () => {
    expect(fmtTokensK(0)).toBe('0');
    expect(fmtTokensK(999)).toBe('999');
    expect(fmtTokensK(1200)).toBe('1.2k');
    expect(fmtTokensK(18000)).toBe('18k');
    expect(fmtTokensK(1_300_000)).toBe('1.3M');
  });
});

describe('LiveStatsLine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mostra os tokens estimados assim que há saída (sem esperar 3s)', () => {
    const startedAt = Date.now();
    const { container } = render(<LiveStatsLine live={{ tokens: 1200, startedAt }} />);
    expect(container.textContent).toContain('~1.2k tok');
  });

  it('mostra o tempo a partir de 1s', () => {
    const startedAt = Date.now();
    const { container } = render(<LiveStatsLine live={{ tokens: 0, startedAt }} />);
    expect(container.textContent).toBe('');
    act(() => vi.advanceTimersByTime(1200));
    expect(container.textContent).toContain('1s');
  });

  it('junta tempo e tokens com separador', () => {
    const startedAt = Date.now();
    const { container } = render(<LiveStatsLine live={{ tokens: 5000, startedAt }} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(container.textContent).toContain('2s');
    expect(container.textContent).toContain('~5.0k tok');
    expect(container.textContent).toContain('·');
  });
});
