// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

afterEach(cleanup);

describe('IconButton', () => {
  it('uses the label as the accessible name', () => {
    render(<IconButton icon="plus" label="Nova conversa" />);
    expect(screen.getByRole('button', { name: 'Nova conversa' })).toBeTruthy();
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(<IconButton icon="plus" label="Nova" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
