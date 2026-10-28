// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { UserMessageRow } from './UserMessageRow';

afterEach(cleanup);

describe('UserMessageRow edit', () => {
  it('only enables "Salvar e reenviar" once the text changed', () => {
    const onEditUser = vi.fn();
    const { getByTitle, getByText, container } = render(<UserMessageRow msg={{ id: 'm1', role: 'user', text: 'oi' } as never} onEditUser={onEditUser} />);
    fireEvent.click(getByTitle('Editar e reenviar'));
    const btn = getByText('Salvar e reenviar').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'oi de novo' } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onEditUser).toHaveBeenCalledWith('m1', 'oi de novo');
  });
});

describe('UserMessageRow body', () => {
  it('renders @mentions highlighted', () => {
    const { getByText } = render(<UserMessageRow msg={{ id: 'm2', role: 'user', text: 'pede pro @Redator' } as never} />);
    expect(getByText('@Redator').className).toContain('text-orange-400');
  });
});
