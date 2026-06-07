import { describe, it, expect } from 'vitest';
import { classifySlash } from './ChatInput';

describe('classifySlash', () => {
  it('maps help/clear/new to app actions', () => {
    expect(classifySlash('/help')).toEqual({ kind: 'help' });
    expect(classifySlash('/clear')).toEqual({ kind: 'new' });
    expect(classifySlash('/new')).toEqual({ kind: 'new' });
  });

  it('maps model switches', () => {
    expect(classifySlash('/model opus')).toEqual({ kind: 'model', model: 'opus' });
    expect(classifySlash('/model sonnet')).toEqual({ kind: 'model', model: 'sonnet' });
    expect(classifySlash('/model haiku')).toEqual({ kind: 'model', model: 'haiku' });
  });

  it('maps mode switches', () => {
    expect(classifySlash('/plan')).toEqual({ kind: 'mode', mode: 'plan' });
    expect(classifySlash('/auto')).toEqual({ kind: 'mode', mode: 'auto' });
    expect(classifySlash('/execute')).toEqual({ kind: 'mode', mode: 'acceptEdits' });
  });

  it('maps prompt-expanding commands to auto mode', () => {
    const att = classifySlash('/attcontext');
    expect(att?.kind).toBe('prompt');
    expect(att && 'mode' in att && att.mode).toBe('auto');
    expect(att && 'text' in att && att.text).toContain('memória');

    const imp = classifySlash('/importgpt');
    expect(imp?.kind).toBe('prompt');
    expect(imp && 'mode' in imp && imp.mode).toBe('auto');
    expect(imp && 'text' in imp && imp.text).toContain('conversations.json');
  });

  it('no longer maps effort (feature removed)', () => {
    for (const e of ['low', 'medium', 'high', 'xhigh', 'max'] as const) {
      expect(classifySlash(`/effort ${e}`)).toBeNull();
    }
  });

  it('is case-insensitive on command and arg', () => {
    expect(classifySlash('/MODEL OPUS')).toEqual({ kind: 'model', model: 'opus' });
  });

  it('returns null for unknown or invalid args (passes through to Claude)', () => {
    expect(classifySlash('/model gpt')).toBeNull();
    expect(classifySlash('/effort turbo')).toBeNull();
    expect(classifySlash('/unknown')).toBeNull();
    expect(classifySlash('not a slash')).toBeNull();
    expect(classifySlash('/')).toBeNull();
  });
});
