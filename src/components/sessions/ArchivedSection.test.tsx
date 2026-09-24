// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ArchivedSection } from './ArchivedSection';
import { TagFilterBar } from './TagFilterBar';

afterEach(cleanup);

describe('ArchivedSection', () => {
  it('reports its expanded state and names the delete button per session', () => {
    const { getByRole } = render(<ArchivedSection archived={[{ id: 's1', title: 'Antiga' }] as never} onUnhide={vi.fn()} onDelete={vi.fn()} />);
    const toggle = getByRole('button', { expanded: false });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('button', { name: 'Excluir sessão Antiga' })).toBeTruthy();
  });
});

describe('TagFilterBar', () => {
  it('marks the active tag as pressed', () => {
    const { getByRole } = render(<TagFilterBar allTags={['dfl', 'deck']} tagFilter="deck" setTagFilter={vi.fn()} clearFilter={vi.fn()} />);
    expect(getByRole('button', { name: '#deck' }).getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: '#dfl' }).getAttribute('aria-pressed')).toBe('false');
  });
});
