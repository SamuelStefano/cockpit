import { describe, it, expect } from 'vitest';
import { fileSlug, codeExt, threadToMarkdown, messageToText } from './export';
import type { Message } from '../data/mock';

describe('fileSlug', () => {
  it('lowercases and dasherizes', () => {
    expect(fileSlug('Deploy na VPS!')).toBe('deploy-na-vps');
  });
  it('trims leading/trailing dashes', () => {
    expect(fileSlug('  --Hello--  ')).toBe('hello');
  });
  it('falls back to "sessao" when empty or symbol-only', () => {
    expect(fileSlug('')).toBe('sessao');
    expect(fileSlug('!!!')).toBe('sessao');
  });
  it('caps length at 60', () => {
    expect(fileSlug('a'.repeat(200)).length).toBe(60);
  });
});

describe('codeExt', () => {
  it('maps known languages', () => {
    expect(codeExt('python')).toBe('py');
    expect(codeExt('bash')).toBe('sh');
    expect(codeExt('TSX')).toBe('tsx');
  });
  it('defaults to txt for unknown/empty', () => {
    expect(codeExt('brainfuck')).toBe('txt');
    expect(codeExt('')).toBe('txt');
  });
});

describe('messageToText', () => {
  it('joins text and code blocks, drops tools', () => {
    const out = messageToText([
      { type: 'text', md: 'oi' },
      { type: 'code', lang: 'ts', code: 'const x = 1;' },
    ]);
    expect(out).toContain('oi');
    expect(out).toContain('```ts');
    expect(out).toContain('const x = 1;');
  });
});

describe('threadToMarkdown', () => {
  it('renders user and assistant turns with a title', () => {
    const msgs: Message[] = [
      { id: 'u1', role: 'user', text: 'pergunta' },
      { id: 'a1', role: 'assistant', blocks: [{ type: 'text', md: 'resposta' }] },
    ];
    const md = threadToMarkdown('Sessão X', msgs);
    expect(md.startsWith('# Sessão X')).toBe(true);
    expect(md).toContain('## 🧑 Você');
    expect(md).toContain('pergunta');
    expect(md).toContain('## 🤖 Claude');
    expect(md).toContain('resposta');
    expect(md.endsWith('\n')).toBe(true);
  });
  it('collapses 3+ blank lines', () => {
    const md = threadToMarkdown('T', [{ id: 'u', role: 'user', text: 'a\n\n\n\nb' }]);
    expect(md).not.toMatch(/\n{3,}/);
  });
});
