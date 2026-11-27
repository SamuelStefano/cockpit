import { describe, expect, it } from 'vitest';
import { ctxFromJsonlTail } from './ctx-tail';

const asst = (usage: object, model = 'claude-opus-5-5') => JSON.stringify({ type: 'assistant', message: { model, usage } });

describe('ctxFromJsonlTail', () => {
  it('returns the last assistant usage summed as context', () => {
    const text = [asst({ input_tokens: 1, cache_read_input_tokens: 10 }), asst({ input_tokens: 5, cache_creation_input_tokens: 20, cache_read_input_tokens: 100 })].join('\n');
    expect(ctxFromJsonlTail(text)).toEqual({ ctxTokens: 125, model: 'claude-opus-5-5', requestedModel: null });
  });
  it('skips a truncated first line and non-assistant records', () => {
    const text = ['{"type":"assistant","message":{"usage":{"input', JSON.stringify({ type: 'user', message: { usage: { input_tokens: 9 } } })].join('\n');
    expect(ctxFromJsonlTail(text)).toBeNull();
  });
  it('returns null for an empty tail', () => {
    expect(ctxFromJsonlTail('')).toBeNull();
  });
});
