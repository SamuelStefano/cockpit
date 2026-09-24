import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { proseBlocks } from './prose-blocks';

// Behavioral guard for the classifyBlock→JSX mapping (PR #227): each block kind
// must still produce the right element. Renders to static HTML and asserts shape.
const html = (md: string, caret = false) =>
  renderToStaticMarkup(React.createElement(React.Fragment, null, proseBlocks(md, 'k', caret)));

describe('proseBlocks rendering', () => {
  it('renders a horizontal rule', () => {
    expect(html('---')).toContain('<hr');
  });

  it('renders a heading at the right level with a slug id', () => {
    const out = html('## Hello World');
    expect(out).toContain('<h2');
    expect(out).toContain('id="hello-world"');
    expect(out).toContain('Hello World');
  });

  it('renders a GFM table with header and body cells', () => {
    const out = html('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(out).toContain('<table');
    expect(out).toContain('<th');
    expect(out).toContain('<td');
    expect(out).toContain('>1<');
  });

  it('renders a blockquote', () => {
    expect(html('> quoted')).toContain('<blockquote');
  });

  it('renders an ordered list as <ol>', () => {
    const out = html('1. first\n2. second');
    expect(out).toContain('<ol');
    expect(out).not.toContain('<ul');
  });

  it('renders an unordered list as <ul>', () => {
    const out = html('- a\n- b');
    expect(out).toContain('<ul');
    expect(out).not.toContain('<ol');
  });

  it('renders a task list with a checked checkbox marker', () => {
    const out = html('- [x] done\n- [ ] todo');
    expect(out).toContain('<ul');
    expect(out).toContain('line-through'); // checked item gets struck text
  });

  it('renders plain prose as a paragraph', () => {
    expect(html('just text')).toContain('<p');
  });

  it('appends a caret to the last block only when requested', () => {
    expect(html('hello', true)).toContain('caret');
    expect(html('hello', false)).not.toContain('caret');
  });

  it('renders a list glued to the paragraph above it as a real list', () => {
    const out = html('Achados:\n- um\n- dois');
    expect(out).toContain('<p');
    expect(out).toContain('<ul');
    expect(out.match(/<li/g)?.length).toBe(2);
    expect(out).not.toContain('- um');
  });

  it('renders a heading glued to its text as a heading', () => {
    const out = html('## Achados\nTexto');
    expect(out).toContain('<h2');
    expect(out).not.toContain('## Achados');
  });

  it('keeps a nested bullet inside a numbered list and the numbers after it', () => {
    const out = html('1. a\n   - sub\n2. b');
    expect(out).toContain('<ol');
    expect(out).toContain('class="list-disc"');
    expect(out).toContain('value="2"');
  });
});
