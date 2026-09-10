import { describe, it, expect } from 'vitest';
import { mergeThinking } from './merge-thinking';
import type { Block, Message } from '../../data/types';

const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });
const assistant = (id: string, blocks: Block[], extra: Partial<Message> = {}): Message =>
  ({ id, role: 'assistant', blocks, ...extra }) as Message;
const think = (text: string): Block => ({ type: 'thinking', text });

describe('mergeThinking', () => {
  it('junta um run de bolhas só-de-pensamento numa bolha só', () => {
    const out = mergeThinking([
      user('u1'),
      assistant('a1', [think('um')]),
      assistant('a2', [think('dois')]),
      assistant('a3', [think('tres')]),
      assistant('a4', [{ type: 'text', md: 'pronto' }]),
    ]);
    expect(out.map((m) => m.id)).toEqual(['u1', 'a1', 'a4']);
    expect(out[1].role === 'assistant' && out[1].blocks).toEqual([think('um\n\ndois\n\ntres')]);
  });

  it('não junta pensamentos separados por texto, digest ou prompt', () => {
    const out = mergeThinking([
      assistant('a1', [think('um')]),
      { id: 'digest:x', role: 'assistant', blocks: [], digest: [] },
      assistant('a2', [think('dois')]),
      user('u1'),
      assistant('a3', [think('tres')]),
    ]);
    expect(out.map((m) => m.id)).toEqual(['a1', 'digest:x', 'a2', 'u1', 'a3']);
  });

  it('bolha com stats fecha o run e o nó herda as stats', () => {
    const stats = { durationMs: 1000 } as never;
    const out = mergeThinking([
      assistant('a1', [think('um')]),
      assistant('a2', [think('dois')], { stats }),
      assistant('a3', [think('tres')]),
    ]);
    expect(out.map((m) => m.id)).toEqual(['a1', 'a3']);
    expect(out[0].role === 'assistant' && out[0].stats).toBe(stats);
  });

  it('funde pensamentos colados dentro da mesma bolha', () => {
    const out = mergeThinking([assistant('a1', [think('um'), think('dois'), { type: 'text', md: 'ok' }, think('tres')])]);
    expect(out[0].role === 'assistant' && out[0].blocks).toEqual([think('um\n\ndois'), { type: 'text', md: 'ok' }, think('tres')]);
  });

  it('preserva a referência entre recomputações', () => {
    const msgs = [assistant('a1', [think('um')]), assistant('a2', [think('dois')])];
    expect(mergeThinking(msgs)[0]).toBe(mergeThinking(msgs)[0]);
    const plain = [assistant('a1', [{ type: 'text', md: 'oi' }])];
    expect(mergeThinking(plain)[0]).toBe(plain[0]);
  });
});
