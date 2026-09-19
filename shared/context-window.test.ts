import { describe, it, expect } from 'vitest';
import {
  contextWindowFor, ctxPctOf, DEFAULT_CONTEXT_WINDOW, LONG_CONTEXT_WINDOW,
} from './context-window';

describe('contextWindowFor', () => {
  it('uses the 1M window for a [1m] variant', () => {
    expect(contextWindowFor('claude-opus-5[1m]')).toBe(LONG_CONTEXT_WINDOW);
    expect(contextWindowFor('claude-fable-5-1[1m]')).toBe(LONG_CONTEXT_WINDOW);
  });

  it('falls back to the default window for a plain model or no model at all', () => {
    expect(contextWindowFor('claude-opus-5')).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(contextWindowFor(null)).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(contextWindowFor(undefined)).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(contextWindowFor('')).toBe(DEFAULT_CONTEXT_WINDOW);
  });
});

describe('ctxPctOf', () => {
  it('reads 210k as almost full on 200k and as 21% on 1M', () => {
    expect(ctxPctOf(210_000, 'claude-opus-5')).toBe(100);
    expect(ctxPctOf(210_000, 'claude-opus-5[1m]')).toBe(21);
  });

  it('clamps at 100 and never goes below 0', () => {
    expect(ctxPctOf(LONG_CONTEXT_WINDOW * 3, 'claude-opus-5[1m]')).toBe(100);
    expect(ctxPctOf(0)).toBe(0);
    expect(ctxPctOf(-10)).toBe(0);
  });

  it('rounds like the old meter did', () => {
    expect(ctxPctOf(DEFAULT_CONTEXT_WINDOW / 2)).toBe(50);
    expect(ctxPctOf(1234)).toBe(1);
  });
});
