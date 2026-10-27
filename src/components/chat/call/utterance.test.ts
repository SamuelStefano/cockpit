import { describe, expect, it } from 'vitest';
import type { Block } from '../../../data/types';
import {
  endOfUtteranceDelay, isBargeIn, isEcho, isSendable, SILENCE_AFTER_SENTENCE_MS, SILENCE_MID_SENTENCE_MS,
  splitForSpeech, toSpokenSummary,
} from './utterance';

const text = (md: string): Block => ({ type: 'text', md });

describe('endOfUtteranceDelay', () => {
  it('waits less after a finished sentence', () => {
    expect(endOfUtteranceDelay('pode rodar os testes.')).toBe(SILENCE_AFTER_SENTENCE_MS);
    expect(endOfUtteranceDelay('você consegue?')).toBe(SILENCE_AFTER_SENTENCE_MS);
  });
  it('waits longer mid-sentence', () => {
    expect(endOfUtteranceDelay('então eu queria que')).toBe(SILENCE_MID_SENTENCE_MS);
  });
});

describe('isSendable', () => {
  it('rejects noise', () => {
    expect(isSendable('  ')).toBe(false);
    expect(isSendable('é')).toBe(false);
    expect(isSendable('oi')).toBe(false);
    expect(isSendable('sim')).toBe(true);
  });
});

describe('echo and barge-in', () => {
  const spoken = 'Terminei o ajuste e os testes passaram. Quer que eu abra o PR?';
  it('detects the assistant voice picked up by the mic', () => {
    expect(isEcho('os testes passaram', spoken)).toBe(true);
    expect(isEcho('Terminei o ajuste', spoken)).toBe(true);
  });
  it('treats empty text as echo', () => {
    expect(isEcho('  ', spoken)).toBe(true);
  });
  it('interrupts on different speech with at least two words', () => {
    expect(isBargeIn('para um segundo', spoken)).toBe(true);
  });
  it('does not interrupt on a single word or on echo', () => {
    expect(isBargeIn('para', spoken)).toBe(false);
    expect(isBargeIn('os testes passaram', spoken)).toBe(false);
  });
  it('ignores accents and punctuation when matching echo', () => {
    expect(isEcho('quer que eu abra o pr', spoken)).toBe(true);
    expect(isEcho('Terminei, o ajuste!', 'terminei o ajuste')).toBe(true);
  });
});

describe('toSpokenSummary', () => {
  it('drops code, tool and thinking blocks', () => {
    const blocks: Block[] = [
      { type: 'code', lang: 'ts', code: 'const x = 1' },
      text('Feito.'),
    ];
    expect(toSpokenSummary(blocks)).toBe('Feito.');
  });
  it('speaks only the text after the last tool call, never mid-turn narration', () => {
    const tool = { type: 'tool', call: { id: 't', name: 'Bash' } } as unknown as Block;
    expect(toSpokenSummary([text('Vou rodar os testes.'), tool, text('Passaram todos.')])).toBe('Passaram todos.');
    expect(toSpokenSummary([text('Vou rodar os testes.'), tool])).toBe('');
  });
  it('strips markdown noise', () => {
    const md = '## Resultado\n\n- **Todos** os testes passaram\n- veja [o PR](https://x.dev/1)\n\n```sh\nnpm test\n```\n\nSegue `useCall`.';
    expect(toSpokenSummary([text(md)])).toBe('Resultado Todos os testes passaram veja o PR Segue useCall.');
  });
  it('keeps only whole sentences up to the limit', () => {
    const md = 'Primeira frase curta. Segunda frase um pouco maior. Terceira frase que estoura o limite.';
    expect(toSpokenSummary([text(md)], 55)).toBe('Primeira frase curta. Segunda frase um pouco maior.');
  });
  it('hard-truncates a single huge sentence', () => {
    const out = toSpokenSummary([text('a'.repeat(100))], 20);
    expect(out).toHaveLength(20);
    expect(out.endsWith('…')).toBe(true);
  });
  it('returns empty when there is no spoken text', () => {
    expect(toSpokenSummary([{ type: 'code', lang: '', code: 'x' }])).toBe('');
    expect(toSpokenSummary([])).toBe('');
  });
});

describe('splitForSpeech', () => {
  it('packs sentences into chunks under the limit', () => {
    expect(splitForSpeech('Uma. Duas. Três.', 10)).toEqual(['Uma. Duas.', 'Três.']);
  });
  it('keeps an oversized sentence whole', () => {
    expect(splitForSpeech('x'.repeat(30) + '.', 10)).toEqual(['x'.repeat(30) + '.']);
  });
  it('returns nothing for empty text', () => {
    expect(splitForSpeech('')).toEqual([]);
  });
});
