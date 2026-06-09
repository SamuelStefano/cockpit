import { describe, it, expect } from 'vitest';
import type { Block, ToolCall } from '../data/mock';
import { upsertTool, appendDelta, appendThinking } from './blocks';

const tool = (over: Partial<ToolCall> = {}): ToolCall => ({
  id: 't1', name: 'Bash', label: 'Bash', command: 'ls', status: 'running', output: [], ...over,
});

describe('upsertTool', () => {
  it('appends a new tool block when id is unseen', () => {
    const out = upsertTool([], tool());
    expect(out).toEqual([{ type: 'tool', tool: tool() }]);
  });

  it('merges done over running, preserving real fields under placeholders', () => {
    const running: Block[] = [{ type: 'tool', tool: tool() }];
    const done = tool({ name: 'tool', label: 'tool', command: '', status: 'done', exit: 0, output: ['hi'] });
    const [b] = upsertTool(running, done) as [{ type: 'tool'; tool: ToolCall }];
    expect(b.tool.status).toBe('done');
    expect(b.tool.output).toEqual(['hi']);
    expect(b.tool.exit).toBe(0);
    expect(b.tool.label).toBe('Bash'); // placeholder não sobrescreve
    expect(b.tool.command).toBe('ls');
  });

  it('keeps prev output when update brings none', () => {
    const running: Block[] = [{ type: 'tool', tool: tool({ output: ['keep'] }) }];
    const [b] = upsertTool(running, tool({ status: 'done', output: [] })) as [{ type: 'tool'; tool: ToolCall }];
    expect(b.tool.output).toEqual(['keep']);
  });

  it('aplica o diff que chega no 2º emit e o preserva até o done', () => {
    const diff = { path: 'a.ts', old: 'x', new: 'y' };
    // 1º emit (content_block_start): input vazio, sem diff
    let blocks = upsertTool([], tool({ name: 'Edit', label: 'Edit' }));
    // 2º emit (assistant completo): traz o diff
    blocks = upsertTool(blocks, tool({ name: 'Edit', label: 'Edit', diff }));
    let b = (blocks[0] as { type: 'tool'; tool: ToolCall }).tool;
    expect(b.diff).toEqual(diff);
    // done (tool_result): sem diff, não pode apagar
    blocks = upsertTool(blocks, tool({ name: 'tool', label: 'tool', command: '', status: 'done', output: ['ok'] }));
    b = (blocks[0] as { type: 'tool'; tool: ToolCall }).tool;
    expect(b.diff).toEqual(diff);
    expect(b.status).toBe('done');
  });
});

describe('appendDelta', () => {
  it('starts a text block when last is not text', () => {
    expect(appendDelta([], 'hi')).toEqual([{ type: 'text', md: 'hi' }]);
  });

  it('concatenates into the trailing text block', () => {
    const out = appendDelta([{ type: 'text', md: 'a' }], 'b');
    expect(out).toEqual([{ type: 'text', md: 'ab' }]);
  });

  it('does not merge across a tool block', () => {
    const blocks: Block[] = [{ type: 'text', md: 'a' }, { type: 'tool', tool: tool() }];
    const out = appendDelta(blocks, 'b');
    expect(out).toHaveLength(3);
    expect(out[2]).toEqual({ type: 'text', md: 'b' });
  });
});

describe('appendThinking', () => {
  it('starts a thinking block when last is not thinking', () => {
    expect(appendThinking([], 'x')).toEqual([{ type: 'thinking', text: 'x' }]);
  });

  it('concatenates into the trailing thinking block, preserving expanded', () => {
    const out = appendThinking([{ type: 'thinking', text: 'a', expanded: true }], 'b');
    expect(out).toEqual([{ type: 'thinking', text: 'ab', expanded: true }]);
  });
});
