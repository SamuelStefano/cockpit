import { describe, it, expect } from 'vitest';
import { parsePlanEvent } from './plan-run';

describe('parsePlanEvent', () => {
  it('extrai delta de texto de um stream_event', () => {
    const ev = parsePlanEvent({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Oi' } } });
    expect(ev).toEqual({ kind: 'text', text: 'Oi' });
  });

  it('finaliza com sucesso: texto + tokens somados (cache conta na entrada)', () => {
    const ev = parsePlanEvent({
      type: 'result', subtype: 'success', is_error: false, result: 'resposta',
      usage: { input_tokens: 10, cache_creation_input_tokens: 9782, cache_read_input_tokens: 0, output_tokens: 40 },
    });
    expect(ev).toEqual({
      kind: 'final',
      result: { status: 'done', resultText: 'resposta', inputTokens: 9792, outputTokens: 40, error: undefined },
    });
  });

  it('finaliza com erro quando is_error', () => {
    const ev = parsePlanEvent({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'deu ruim', usage: {} });
    expect(ev).toMatchObject({ kind: 'final', result: { status: 'error', error: 'deu ruim' } });
  });

  it('ignora eventos que não são texto nem result', () => {
    expect(parsePlanEvent({ type: 'assistant', usage: {} })).toBeNull();
    expect(parsePlanEvent({ type: 'system' })).toBeNull();
  });
});
