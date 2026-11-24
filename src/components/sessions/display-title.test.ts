import { describe, expect, it } from 'vitest';
import { displayTitle } from './display-title';

describe('displayTitle', () => {
  it('capitalizes a lowercase prompt', () => {
    expect(displayTitle('faça meu daily report completinho')).toBe('Faça meu daily report completinho');
  });

  it('drops leading dots, dashes and emoji', () => {
    expect(displayTitle('. - nao responder')).toBe('Nao responder');
    expect(displayTitle('💬 comentou em Itera')).toBe('Comentou em Itera');
  });

  it('shortens links to their host and removes ids', () => {
    expect(displayTitle('https://github.com/devfellowship/dfl-lesson-studio/pull/907')).toBe('Github.com');
    expect(displayTitle('💬 edff2cea-595b-4593-91f7-ab348c8ab7e4 comentou em Itera')).toBe('Comentou em Itera');
    expect(displayTitle('veja https://www.x.com/a/status/1?s=46 Marc')).toBe('Veja x.com Marc');
  });

  it('strips markdown marks, extra spaces and trailing punctuation', () => {
    expect(displayTitle('**Bug**   visual  deck mobile:')).toBe('Bug visual deck mobile');
  });

  it('falls back to the raw text when nothing is left', () => {
    expect(displayTitle('...')).toBe('...');
    expect(displayTitle('')).toBe('Sem título');
  });
});
