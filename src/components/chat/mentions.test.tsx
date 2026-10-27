// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { renderMentions } from './mentions';

afterEach(cleanup);

describe('renderMentions', () => {
  it('wraps @names and keeps the rest of the text', () => {
    const { container } = render(<p>{renderMentions('oi @Redator e @pesquisador-1, valeu')}</p>);
    const spans = [...container.querySelectorAll('span')].map((s) => s.textContent);
    expect(spans).toEqual(['@Redator', '@pesquisador-1']);
    expect(container.textContent).toBe('oi @Redator e @pesquisador-1, valeu');
  });

  it('ignores e-mail addresses', () => {
    const { container } = render(<p>{renderMentions('fala com a@b.com')}</p>);
    expect(container.querySelectorAll('span').length).toBe(0);
  });
});
