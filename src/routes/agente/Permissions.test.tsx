// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Permissions } from './Permissions';
import { ALL_PERMS } from './permissions';

describe('Permissions', () => {
  it('toggles one permission at a time', () => {
    const onChange = vi.fn();
    render(<Permissions value={ALL_PERMS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Escrever' }));
    expect(onChange).toHaveBeenCalledWith({ read: true, write: false, net: true });
  });

  it('does not react when disabled', () => {
    const onChange = vi.fn();
    render(<Permissions value={ALL_PERMS} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('switch', { name: 'Rede' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
