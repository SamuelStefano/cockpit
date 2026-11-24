// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { EditableTitle } from './EditableTitle';

afterEach(cleanup);

describe('EditableTitle', () => {
  it('names the rename button and the input it opens', () => {
    const { getByRole } = render(<EditableTitle id="s1" title="Minha sessão" editable onRename={vi.fn()} />);
    fireEvent.click(getByRole('button', { name: 'Renomear sessão: Minha sessão' }));
    expect(getByRole('textbox', { name: 'Nome da sessão' })).toBeTruthy();
  });
});
