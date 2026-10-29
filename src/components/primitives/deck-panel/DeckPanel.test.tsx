// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Markdown } from '../Markdown';

afterEach(cleanup);

const panel = JSON.stringify({
  title: 'Hoje',
  columns: [
    { label: 'Feito', tone: 'green', items: [{ title: 'Relay fix', detail: 'Merged and deployed' }] },
    { label: 'Pendente', tone: 'yellow', items: ['Reel Itera'] },
  ],
});

describe('deck-panel fence', () => {
  it('renders columns and opens item detail', () => {
    render(<Markdown md={'```deck-panel\n' + panel + '\n```'} />);
    expect(screen.getByText('Reel Itera')).toBeTruthy();
    expect(screen.getByText('1 Feito')).toBeTruthy();
    fireEvent.click(screen.getByText('Relay fix'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Merged and deployed')).toBeTruthy();
  });

  it('falls back to code while JSON is incomplete', () => {
    const { container } = render(<Markdown md={'```deck-panel\n{"title":"Ho'} />);
    expect(container.querySelector('section[aria-label]')).toBeNull();
    expect(container.textContent).toContain('"title"');
  });
});
