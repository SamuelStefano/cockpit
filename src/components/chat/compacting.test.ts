import { describe, it, expect } from 'vitest';
import { COMPACT_SILENCE_MS, frameFingerprint, isCompacting, silenceExplained } from './compacting';
import { CONTEXT_LIMIT } from '../../lib/format';
import type { Block, Message, ToolCall } from '../../data/types';

const cheio = Math.round(CONTEXT_LIMIT * 0.9);
const folgado = Math.round(CONTEXT_LIMIT * 0.4);
const base = { running: true, silentMs: COMPACT_SILENCE_MS, contextTokens: cheio, quotaPaused: false, explained: false };

describe('isCompacting', () => {
  it('silêncio longo com contexto cheio é compactação', () => {
    expect(isCompacting(base)).toBe(true);
  });

  it('o corte é inclusivo — no limite já acende', () => {
    expect(isCompacting({ ...base, silentMs: COMPACT_SILENCE_MS })).toBe(true);
    expect(isCompacting({ ...base, silentMs: COMPACT_SILENCE_MS - 1 })).toBe(false);
  });

  it('turno parado nunca compacta', () => {
    expect(isCompacting({ ...base, running: false })).toBe(false);
  });

  it('silêncio já explicado (tool aberta ou turno sem frame) não é compactação', () => {
    expect(isCompacting({ ...base, explained: true })).toBe(false);
  });

  it('quota estourada explica o silêncio e tem banner próprio', () => {
    expect(isCompacting({ ...base, quotaPaused: true })).toBe(false);
  });

  it('contexto folgado não compacta — o silêncio é outro', () => {
    expect(isCompacting({ ...base, contextTokens: folgado })).toBe(false);
  });

  it('sem medidor de contexto (0) não chuta compactação', () => {
    expect(isCompacting({ ...base, contextTokens: 0 })).toBe(false);
  });
});

const tool = (status: ToolCall['status'], output: string[] = []): ToolCall => ({ id: 't1', name: 'Bash', label: 'Bash', command: 'ls', status, output });

describe('silenceExplained', () => {
  it('ferramenta aberta na última bolha explica o silêncio', () => {
    const msgs: Message[] = [{ id: 'a1', role: 'assistant', blocks: [{ type: 'tool', tool: tool('running') }] }];
    expect(silenceExplained(msgs)).toBe(true);
  });

  it('ferramenta concluída deixa o silêncio sem explicação', () => {
    const msgs: Message[] = [{ id: 'a1', role: 'assistant', blocks: [{ type: 'tool', tool: tool('done') }] }];
    expect(silenceExplained(msgs)).toBe(false);
  });

  it('turno que ainda não produziu frame do assistente está no prefill', () => {
    expect(silenceExplained([])).toBe(true);
    expect(silenceExplained([{ id: 'u1', role: 'user', text: 'oi' }])).toBe(true);
  });
});

describe('frameFingerprint', () => {
  const assistant = (blocks: Block[]): Message => ({ id: 'a1', role: 'assistant', blocks });

  it('texto crescendo muda a impressão digital', () => {
    const a = frameFingerprint([assistant([{ type: 'text', md: 'oi' }])]);
    const b = frameFingerprint([assistant([{ type: 'text', md: 'oi la' }])]);
    expect(a).not.toBe(b);
  });

  it('ferramenta fechando muda a impressão digital', () => {
    const a = frameFingerprint([assistant([{ type: 'tool', tool: tool('running') }])]);
    const b = frameFingerprint([assistant([{ type: 'tool', tool: tool('done') }])]);
    expect(a).not.toBe(b);
  });

  it('mesmo conteúdo em array novo mantém a impressão digital', () => {
    const msgs: Message[] = [assistant([{ type: 'text', md: 'oi' }])];
    expect(frameFingerprint([...msgs])).toBe(frameFingerprint(msgs));
  });

  it('thread vazia não quebra', () => {
    expect(frameFingerprint([])).toBe('');
  });
});
