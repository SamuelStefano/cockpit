// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SelectionQuote } from './SelectionQuote';

afterEach(cleanup);

describe('SelectionQuote', () => {
  it('quotes the selected text into the composer', () => {
    const onQuote = vi.fn();
    const r = render(<SelectionQuote onQuote={onQuote}><p>olá mundo</p></SelectionQuote>);
    const p = r.getByText('olá mundo');
    const range = document.createRange();
    range.selectNodeContents(p);
    vi.spyOn(document, 'getSelection').mockReturnValue({
      toString: () => 'olá mundo',
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection);
    fireEvent.mouseUp(p);
    fireEvent.click(r.getByRole('button', { name: 'Adicionar ao chat' }));
    expect(onQuote).toHaveBeenCalledWith('olá mundo');
  });

  it('ignores a selection inside the composer', () => {
    const onQuote = vi.fn();
    const r = render(<SelectionQuote onQuote={onQuote}><textarea defaultValue="rascunho" /></SelectionQuote>);
    const ta = r.getByRole('textbox');
    const range = document.createRange();
    range.selectNodeContents(ta);
    vi.spyOn(document, 'getSelection').mockReturnValue({
      toString: () => 'rascunho',
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection);
    fireEvent.mouseUp(ta);
    expect(r.queryByRole('button', { name: 'Adicionar ao chat' })).toBeNull();
    expect(onQuote).not.toHaveBeenCalled();
  });
});
