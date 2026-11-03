// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Markdown } from '../Markdown';
import { SessionLinkContext } from '../markdown/session-link-context';

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

describe('session links', () => {
  const sid = '4248d7d1-aaaa-bbbb-cccc-0123456789ab';
  const withCtx = (md: string, open = vi.fn()) => {
    render(
      <SessionLinkContext.Provider value={{ ids: [sid], open }}>
        <Markdown md={md} />
      </SessionLinkContext.Provider>,
    );
    return open;
  };

  it('links a known short id in prose', () => {
    const open = withCtx('done in 4248d7d1 and `4248d7d1`, not deadbeef');
    const links = screen.getAllByTitle('Open session');
    expect(links).toHaveLength(2);
    fireEvent.click(links[0]);
    expect(open).toHaveBeenCalledWith(sid);
    expect(screen.getByText(/deadbeef/).closest('button')).toBeNull();
  });

  it('opens the session from a card', () => {
    const md = '```deck-panel\n' + JSON.stringify({ columns: [{ label: 'A', tone: 'green', items: [{ title: 'Card', session: '4248d7d1' }] }] }) + '\n```';
    const open = withCtx(md);
    fireEvent.click(screen.getByText('Card'));
    fireEvent.click(screen.getByText(/Open session 4248d7d1/));
    expect(open).toHaveBeenCalledWith(sid);
  });

  it('stays plain text without a provider', () => {
    render(<Markdown md="see 4248d7d1" />);
    expect(screen.queryByTitle('Open session')).toBeNull();
  });
});
