import { describe, it, expect, vi } from 'vitest';
import { buildActions } from './MessageActionsHost';

describe('buildActions', () => {
  it('always offers copy and only the handlers that exist', () => {
    const copy = vi.fn();
    const list = buildActions({ text: 'hi', onQuote: vi.fn() }, copy);
    expect(list.map((a) => a.id)).toEqual(['copy', 'quote']);
    list[0].run();
    expect(copy).toHaveBeenCalledWith('hi');
  });
  it('adds edit and regenerate when provided', () => {
    const list = buildActions({ text: 'x', onEdit: vi.fn(), onRegenerate: vi.fn(), onMemorize: vi.fn() }, vi.fn());
    expect(list.map((a) => a.id)).toEqual(['copy', 'edit', 'regen', 'memorize']);
  });
});
