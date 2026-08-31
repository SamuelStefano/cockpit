import { describe, it, expect } from 'vitest';
import { classifySlash, isLocalSlash, slashHint } from './slash';

describe('classifySlash', () => {
  it('returns null for non-slash text', () => {
    expect(classifySlash('hello')).toBeNull();
    expect(classifySlash('')).toBeNull();
    expect(classifySlash('a /help mid-line')).toBeNull();
  });

  it('returns null for an unknown command (passes through to Claude)', () => {
    expect(classifySlash('/compact')).toBeNull();
    expect(classifySlash('/unknown thing')).toBeNull();
    expect(classifySlash('/')).toBeNull();
  });

  // O /effort foi removido: se voltar a classificar, o comando deixa de chegar ao
  // Claude — que hoje é quem o entende — e passa a ser engolido aqui em silêncio.
  it('does not intercept /effort (command belongs to the CLI now)', () => {
    for (const e of ['low', 'medium', 'high', 'xhigh', 'max', 'turbo']) {
      expect(classifySlash(`/effort ${e}`)).toBeNull();
    }
  });

  it('classifies help', () => {
    expect(classifySlash('/help')).toEqual({ kind: 'help' });
  });

  it('classifies clear and new as a new session', () => {
    expect(classifySlash('/clear')).toEqual({ kind: 'new' });
    expect(classifySlash('/new')).toEqual({ kind: 'new' });
  });

  it('classifies model switches, requiring a valid model arg', () => {
    expect(classifySlash('/model opus')).toEqual({ kind: 'model', model: 'opus' });
    expect(classifySlash('/model sonnet')).toEqual({ kind: 'model', model: 'sonnet' });
    expect(classifySlash('/model haiku')).toEqual({ kind: 'model', model: 'haiku' });
    expect(classifySlash('/model gpt')).toBeNull();
    expect(classifySlash('/model')).toBeNull();
  });

  it('classifies mode commands', () => {
    expect(classifySlash('/plan')).toEqual({ kind: 'mode', mode: 'plan' });
    expect(classifySlash('/auto')).toEqual({ kind: 'mode', mode: 'auto' });
    expect(classifySlash('/execute')).toEqual({ kind: 'mode', mode: 'acceptEdits' });
  });

  it('expands prompt commands and pins them to auto mode', () => {
    const att = classifySlash('/attcontext');
    expect(att?.kind).toBe('prompt');
    expect(att && 'mode' in att && att.mode).toBe('auto');
    expect(att && 'text' in att && att.text).toContain('memória');

    const imp = classifySlash('/importgpt');
    expect(imp?.kind).toBe('prompt');
    expect(imp && 'mode' in imp && imp.mode).toBe('auto');
    expect(imp && 'text' in imp && imp.text).toContain('conversations.json');
  });

  it('is case-insensitive on the command and model arg', () => {
    expect(classifySlash('/HELP')).toEqual({ kind: 'help' });
    expect(classifySlash('/Model Opus')).toEqual({ kind: 'model', model: 'opus' });
  });
});

describe('isLocalSlash / slashHint', () => {
  it('flags intercepted commands and explains the rest', () => {
    expect(isLocalSlash('help')).toBe(true);
    expect(isLocalSlash('compact')).toBe(false);
    expect(slashHint('help')).toMatch(/atalhos/);
    expect(slashHint('compact')).toMatch(/Claude/);
  });
});
