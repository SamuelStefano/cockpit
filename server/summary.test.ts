import { describe, it, expect } from 'vitest';
import { transcriptText, summaryUserPrompt, parseSummaryResponse } from './summary';
import type { Message } from '../shared/protocol';

describe('transcriptText', () => {
  it('flattens user and assistant turns with role prefixes', () => {
    const msgs: Message[] = [
      { id: 'u1', role: 'user', text: 'oi' },
      { id: 'a1', role: 'assistant', blocks: [{ type: 'text', md: 'olá' }] },
    ];
    expect(transcriptText(msgs)).toBe('Você: oi\nClaude: olá');
  });

  it('joins assistant text and code blocks, skips tool/thinking', () => {
    const msgs: Message[] = [
      {
        id: 'a1',
        role: 'assistant',
        blocks: [
          { type: 'text', md: 'rodando' },
          { type: 'code', lang: 'ts', code: 'x=1' },
          { type: 'thinking', text: 'segredo' },
        ],
      },
    ];
    expect(transcriptText(msgs)).toBe('Claude: rodando x=1');
  });

  it('drops empty turns', () => {
    const msgs: Message[] = [
      { id: 'u1', role: 'user', text: '   ' },
      { id: 'a1', role: 'assistant', blocks: [] },
      { id: 'u2', role: 'user', text: 'real' },
    ];
    expect(transcriptText(msgs)).toBe('Você: real');
  });

  it('keeps only the tail when over the cap', () => {
    const msgs: Message[] = [
      { id: 'u1', role: 'user', text: 'A'.repeat(100) },
      { id: 'u2', role: 'user', text: 'FIM' },
    ];
    const out = transcriptText(msgs, 20);
    expect(out.length).toBe(20);
    expect(out.endsWith('FIM')).toBe(true);
  });

  it('returns empty string for no usable content', () => {
    expect(transcriptText([])).toBe('');
  });

  it('skips compact divider messages', () => {
    const msgs: Message[] = [
      { id: 'u1', role: 'user', text: 'oi' },
      { id: 'c1', role: 'compact', trigger: 'auto' },
      { id: 'a1', role: 'assistant', blocks: [{ type: 'text', md: 'olá' }] },
    ];
    expect(transcriptText(msgs)).toBe('Você: oi\nClaude: olá');
  });
});

describe('summaryUserPrompt', () => {
  it('embeds the transcript after the instruction separator', () => {
    const p = summaryUserPrompt('Você: oi');
    expect(p).toContain('Você: oi');
    expect(p).toContain('---');
    expect(p.indexOf('---')).toBeLessThan(p.indexOf('Você: oi'));
  });
});

describe('parseSummaryResponse', () => {
  it('extracts text content', () => {
    expect(parseSummaryResponse({ content: [{ type: 'text', text: 'corrige bug do ws' }] }))
      .toBe('corrige bug do ws');
  });

  it('strips surrounding quotes, backticks and trailing period', () => {
    expect(parseSummaryResponse({ content: [{ type: 'text', text: '"resumo aqui."' }] }))
      .toBe('resumo aqui');
    expect(parseSummaryResponse({ content: [{ type: 'text', text: '`código novo`' }] }))
      .toBe('código novo');
  });

  it('collapses internal whitespace', () => {
    expect(parseSummaryResponse({ content: [{ type: 'text', text: 'a   b\n c' }] }))
      .toBe('a b c');
  });

  it('caps length at 140 chars', () => {
    const long = 'x'.repeat(300);
    expect(parseSummaryResponse({ content: [{ type: 'text', text: long }] })!.length).toBe(140);
  });

  it('returns null on missing/empty/invalid content', () => {
    expect(parseSummaryResponse(null)).toBeNull();
    expect(parseSummaryResponse({})).toBeNull();
    expect(parseSummaryResponse({ content: [] })).toBeNull();
    expect(parseSummaryResponse({ content: [{ type: 'text', text: '   ' }] })).toBeNull();
    expect(parseSummaryResponse({ content: [{ type: 'tool_use', text: 'x' }] })).toBeNull();
  });
});
