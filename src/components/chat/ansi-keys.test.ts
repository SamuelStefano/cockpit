import { describe, it, expect } from 'vitest';
import { stripAnsiArrows } from './ansi-keys';

describe('stripAnsiArrows', () => {
  it('leaves plain text untouched', () => {
    expect(stripAnsiArrows('bom dia')).toEqual({ text: 'bom dia', arrows: [], at: 0 });
  });

  it('pulls the raw CSI cursor sequence out of an empty field', () => {
    expect(stripAnsiArrows('[A')).toEqual({ text: '', arrows: ['up'], at: 0 });
    expect(stripAnsiArrows('[B')).toEqual({ text: '', arrows: ['down'], at: 0 });
  });

  it('handles the SS3 variant sent under application cursor keys', () => {
    expect(stripAnsiArrows('OA')).toEqual({ text: '', arrows: ['up'], at: 0 });
  });

  it('handles the caret-notation rendering typed as plain characters', () => {
    expect(stripAnsiArrows('^[[A')).toEqual({ text: '', arrows: ['up'], at: 0 });
    expect(stripAnsiArrows('^[OB')).toEqual({ text: '', arrows: ['down'], at: 0 });
  });

  it('reports the caret where the sequence was removed from surrounding text', () => {
    const r = stripAnsiArrows('linha um\nlin[Aha dois');
    expect(r.text).toBe('linha um\nlinha dois');
    expect(r.arrows).toEqual(['up']);
    expect(r.at).toBe(12);
  });

  it('collects repeated sequences in order (key held down)', () => {
    expect(stripAnsiArrows('^[[A^[[A^[[B').arrows).toEqual(['up', 'up', 'down']);
  });

  it('never eats a bare bracket that is legitimate text', () => {
    expect(stripAnsiArrows('array[A]')).toEqual({ text: 'array[A]', arrows: [], at: 0 });
  });
});
