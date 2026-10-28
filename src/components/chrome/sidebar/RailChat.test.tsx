// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RailChat } from './RailChat';
import type { Session } from '../../../data/types';

afterEach(cleanup);
const session: Session = { id: 's1', title: 'Fix login', relative: '', snippet: '', mtime: 1, hasTerminal: false, active: false };

describe('RailChat', () => {
  it('labels the tile with the title, shows the initial and opens the chat', () => {
    const onSelect = vi.fn();
    render(<RailChat session={session} active={false} busy={false} onSelect={onSelect} />);
    const b = screen.getByRole('button', { name: 'Fix login' });
    expect(b.textContent).toBe('F');
    expect(b.getAttribute('data-busy')).toBeNull();
    fireEvent.click(b);
    expect(onSelect).toHaveBeenCalledWith('s1');
  });
  it('flags a working chat', () => {
    render(<RailChat session={session} active busy onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Fix login' }).getAttribute('data-busy')).toBe('true');
  });
});
