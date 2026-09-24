import { describe, it, expect } from 'vitest';
import { classifyBlock, parseTableCells, parseListItems, splitBlock, proseBlockStrings } from './classify-block';

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
      { depth: 0, text: 'two', done: null, num: 2 },
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

describe('splitBlock', () => {
  it('splits a list that follows a paragraph line with no blank line', () => {
    expect(splitBlock('Achados:\n- um\n- dois')).toEqual(['Achados:', '- um\n- dois']);
  });

  it('splits a heading glued to the text under it', () => {
    expect(splitBlock('## Achados\nTexto da seção')).toEqual(['## Achados', 'Texto da seção']);
  });

  it('splits a table that follows a paragraph line', () => {
    expect(splitBlock('Resumo:\n| a | b |\n|---|---|\n| 1 | 2 |')).toEqual(['Resumo:', '| a | b |\n|---|---|\n| 1 | 2 |']);
  });

  it('splits the paragraph that follows a list', () => {
    expect(splitBlock('- um\n- dois\nDepois da lista.')).toEqual(['- um\n- dois', 'Depois da lista.']);
  });

  it('keeps a wrapped sentence starting with a number as prose (only "1." interrupts a paragraph)', () => {
    expect(splitBlock('Em setembro de\n2026. aconteceu isso')).toEqual(['Em setembro de\n2026. aconteceu isso']);
  });

  it('leaves single-structure blocks and blockquotes whole', () => {
    expect(splitBlock('- a\n- b')).toEqual(['- a\n- b']);
    expect(splitBlock('texto\nquebrado')).toEqual(['texto\nquebrado']);
    expect(splitBlock('> - a\n> b')).toEqual(['> - a\n> b']);
  });

  it('proseBlockStrings flattens blank-line blocks and their runs in order', () => {
    expect(proseBlockStrings('## T\nx\n\nLista:\n- a')).toEqual(['## T', 'x', 'Lista:', '- a']);
  });
});

describe('classifyBlock — mixed and wrapped lists', () => {
  it('a numbered list with nested bullets is one ordered list, source numbers kept', () => {
    const b = classifyBlock('1. primeiro\n2. segundo\n   - sub\n3. terceiro');
    expect(b.kind).toBe('list');
    if (b.kind !== 'list') return;
    expect(b.ordered).toBe(true);
    expect(b.items.map((i) => [i.depth, i.text, i.num])).toEqual([[0, 'primeiro', 1], [0, 'segundo', 2], [1, 'sub', undefined], [0, 'terceiro', 3]]);
  });

  it('an indented line without a marker continues the item above', () => {
    const b = classifyBlock('- item longo\n  que quebrou\n- outro');
    expect(b).toMatchObject({ kind: 'list', items: [{ text: 'item longo que quebrou' }, { text: 'outro' }] });
  });
});
