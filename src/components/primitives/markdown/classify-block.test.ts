import { describe, it, expect } from 'vitest';
import { classifyBlock, parseTableCells, parseListItems } from './classify-block';

describe('parseTableCells', () => {
  it('strips outer pipes and trims each cell', () => {
    expect(parseTableCells('| a | b | c |')).toEqual(['a', 'b', 'c']);
  });

  it('handles a row without outer pipes', () => {
    expect(parseTableCells('a | b')).toEqual(['a', 'b']);
  });
});

describe('parseListItems', () => {
  it('strips the bullet/number marker off each item', () => {
    expect(parseListItems(['- one', '2. two'])).toEqual([
      { depth: 0, text: 'one', done: null },
      { depth: 0, text: 'two', done: null },
    ]);
  });

  it('detects task checkboxes and their done state', () => {
    expect(parseListItems(['- [ ] todo', '- [x] done'])).toEqual([
      { depth: 0, text: 'todo', done: false },
      { depth: 0, text: 'done', done: true },
    ]);
  });

  it('computes nesting depth from leading spaces, capped at 4', () => {
    expect(parseListItems(['- a', '  - b', '            - deep']).map((i) => i.depth)).toEqual([0, 1, 4]);
  });
});

describe('classifyBlock', () => {
  it('classifies a horizontal rule', () => {
    expect(classifyBlock('---')).toEqual({ kind: 'hr' });
  });

  it('classifies a heading with its level and text', () => {
    expect(classifyBlock('## Title here')).toEqual({ kind: 'heading', level: 2, text: 'Title here' });
  });

  it('does not treat a multi-line block as a heading', () => {
    expect(classifyBlock('# a\nmore').kind).toBe('paragraph');
  });

  it('classifies a GFM table into header and rows', () => {
    expect(classifyBlock('| a | b |\n|---|---|\n| 1 | 2 |')).toEqual({
      kind: 'table',
      header: ['a', 'b'],
      rows: [['1', '2']],
    });
  });

  it('classifies a blockquote, stripping the markers', () => {
    expect(classifyBlock('> one\n> two')).toEqual({ kind: 'blockquote', lines: ['one', 'two'] });
  });

  it('classifies an ordered list', () => {
    const b = classifyBlock('1. a\n2. b');
    expect(b.kind).toBe('list');
    expect(b).toMatchObject({ ordered: true, task: false });
  });

  it('flags an unordered list with checkboxes as a task list', () => {
    const b = classifyBlock('- [ ] a\n- [x] b');
    expect(b).toMatchObject({ kind: 'list', ordered: false, task: true });
  });

  it('falls back to a paragraph for plain prose', () => {
    expect(classifyBlock('just text\nwrapped')).toEqual({ kind: 'paragraph', lines: ['just text', 'wrapped'] });
  });
});
