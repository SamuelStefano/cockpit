import { describe, it, expect } from 'vitest';
import { hasVisibleAssistantContent, isQuestionTool } from './visible-blocks';
import type { Block, ToolCall } from '../../data/mock';

const tool = (over: Partial<ToolCall> = {}): Block => ({
  type: 'tool',
  tool: { id: 't1', name: 'Bash', label: 'bash', command: 'ls', status: 'done', output: [], ...over },
});

const question = tool({
  name: 'AskUserQuestion',
  questions: [{ question: 'q?', header: 'h', multiSelect: false, options: [] }],
});

describe('hasVisibleAssistantContent', () => {
  it('texto/código/thinking são visíveis independente do toggle', () => {
    expect(hasVisibleAssistantContent([{ type: 'text', md: 'oi' }], false)).toBe(true);
    expect(hasVisibleAssistantContent([{ type: 'code', code: 'x', lang: 'ts' }], false)).toBe(true);
    expect(hasVisibleAssistantContent([{ type: 'thinking', text: 'hmm' }], false)).toBe(true);
  });

  it('mensagem só-de-tools some com tools ocultas', () => {
    expect(hasVisibleAssistantContent([tool(), tool()], false)).toBe(false);
  });

  it('mensagem só-de-tools aparece com tools visíveis', () => {
    expect(hasVisibleAssistantContent([tool()], true)).toBe(true);
  });

  it('AskUserQuestion conta como visível mesmo com tools ocultas', () => {
    expect(hasVisibleAssistantContent([question], false)).toBe(true);
  });

  it('lista vazia não é visível', () => {
    expect(hasVisibleAssistantContent([], true)).toBe(false);
  });
});

describe('isQuestionTool', () => {
  it('exige nome AskUserQuestion E perguntas não-vazias', () => {
    const base: ToolCall = { id: 'a', name: 'AskUserQuestion', label: '', command: '', status: 'done', output: [], questions: [] };
    expect(isQuestionTool(base)).toBe(false);
    expect(isQuestionTool({ ...base, name: 'Bash' })).toBe(false);
  });
});
