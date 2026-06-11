// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { LiveStatsLine, fmtTokensK, spinnerGlyph, spinnerVerb, SPINNER_VERBS, ThinkingDots } from './Thinking';

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
    expect(container.textContent).toContain('~1.2k tokens');
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
    expect(container.textContent).toContain('~5.0k tokens');
    expect(container.textContent).toContain('·');
  });
});

describe('spinnerGlyph', () => {
  it('faz ping-pong na sequência (cresce e encolhe)', () => {
    expect(spinnerGlyph(0)).toBe('·');
    expect(spinnerGlyph(5)).toBe('✽');
    expect(spinnerGlyph(6)).toBe('✻');
    expect(spinnerGlyph(9)).toBe('✢');
    expect(spinnerGlyph(10)).toBe('·');
    expect(spinnerGlyph(11)).toBe('✢');
  });

  it('aceita tick negativo sem quebrar', () => {
    expect(spinnerGlyph(-1)).toBe('✢');
    expect(spinnerGlyph(-10)).toBe('·');
  });
});

describe('spinnerVerb', () => {
  it('rotaciona com wrap pelo módulo', () => {
    expect(spinnerVerb(0)).toBe(SPINNER_VERBS[0]);
    expect(spinnerVerb(SPINNER_VERBS.length)).toBe(SPINNER_VERBS[0]);
    expect(spinnerVerb(SPINNER_VERBS.length + 3)).toBe(SPINNER_VERBS[3]);
  });

  it('índice negativo cai num verbo válido', () => {
    expect(SPINNER_VERBS).toContain(spinnerVerb(-2));
  });
});

describe('ThinkingDots', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renderiza estrelinha + verbo com reticências', () => {
    const { container } = render(<ThinkingDots />);
    const star = container.querySelector('.spinner-star');
    expect(star).not.toBeNull();
    expect(['·', '✢', '✳', '✶', '✻', '✽']).toContain(star!.textContent);
    const verb = SPINNER_VERBS.find((v) => container.textContent?.includes(`${v}…`));
    expect(verb).toBeDefined();
  });

  it('a estrelinha anima (glyph muda com o tempo)', () => {
    const { container } = render(<ThinkingDots />);
    const before = container.querySelector('.spinner-star')!.textContent;
    act(() => vi.advanceTimersByTime(140));
    const after = container.querySelector('.spinner-star')!.textContent;
    expect(after).not.toBe(before);
  });
});
