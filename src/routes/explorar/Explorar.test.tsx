// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Explorar } from './Explorar';

describe('Explorar', () => {
  it('lists every card for an admin and opens the target path', () => {
    const onOpen = vi.fn();
    render(<Explorar role="admin" onOpen={onOpen} />);
    expect(screen.getByRole('heading', { name: 'Explorar' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /Reuniões/ }));
    expect(onOpen).toHaveBeenCalledWith('/agentes/reunioes');
  });

  it('renders no card for a student', () => {
    render(<Explorar role="student" onOpen={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
