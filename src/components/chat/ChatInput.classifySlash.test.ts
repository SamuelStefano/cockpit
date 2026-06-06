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

  it('maps every effort level', () => {
    for (const e of ['low', 'medium', 'high', 'xhigh', 'max'] as const) {
      expect(classifySlash(`/effort ${e}`)).toEqual({ kind: 'effort', effort: e });
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
