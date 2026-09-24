// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { KanbanItemDrawer } from './KanbanItemDrawer';
import type { SessionKanbanItem } from './kanban-items';

afterEach(cleanup);

const item: SessionKanbanItem = {
  nodeId: 's:a', sessionId: 'a', title: 'worker', subtitle: 'first message', orchestratorChild: true,
  status: 'doing', running: true, waitingOnUser: false, needsAttention: false, mtime: 10,
};
const noop = () => {};
const props = { item, onClose: noop, onOpenSession: noop, onOpenTerm: noop, onMove: noop, onHide: noop };

describe('KanbanItemDrawer', () => {
  it('requests a transcript peek for the open session', () => {
    const onPeek = vi.fn();
    render(<KanbanItemDrawer {...props} onPeek={onPeek} />);
    expect(onPeek).toHaveBeenCalledWith('a');
  });

  it('renders the last message tail, PRs and links', () => {
    const { getByText } = render(
      <KanbanItemDrawer {...props} onPeek={noop} peek={{
        lastAssistant: 'PR opened, tests green.',
        prs: [{ url: 'https://github.com/o/r/pull/9', label: 'PR #9 · o/r' }],
        links: ['https://example.dev/report'],
      }} />,
    );
    expect(getByText('PR opened, tests green.')).toBeTruthy();
    expect(getByText('PR #9 · o/r').getAttribute('href')).toBe('https://github.com/o/r/pull/9');
    expect(getByText('https://example.dev/report').getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('shows no transcript sections while the peek is pending or empty', () => {
    const { queryByText, rerender } = render(<KanbanItemDrawer {...props} onPeek={noop} />);
    expect(queryByText('Last message')).toBeNull();
    rerender(<KanbanItemDrawer {...props} onPeek={noop} peek={{ prs: [], links: [] }} />);
    expect(queryByText('Links')).toBeNull();
  });

  // canvas review item 9: peek===undefined and peek===null both used to
  // render as nothing — no way to tell "still loading" from "unreadable".
  it('shows a loading skeleton while the peek is undefined (in flight)', () => {
    const { getByText } = render(<KanbanItemDrawer {...props} onPeek={noop} />);
    expect(getByText('lendo transcript…')).toBeTruthy();
  });

  it('shows "transcript ilegível" when the peek resolved to null', () => {
    const { getByText, queryByText } = render(<KanbanItemDrawer {...props} onPeek={noop} peek={null} />);
    expect(getByText('transcript ilegível')).toBeTruthy();
    expect(queryByText('lendo transcript…')).toBeNull();
  });

  it('Escape closes the drawer', () => {
    const onClose = vi.fn();
    render(<KanbanItemDrawer {...props} onClose={onClose} onPeek={noop} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
  });

  // item 9: footer shrank to terminal/abrir chat + Segmented Done|Completed +
  // ghost ocultar — "mover p/ ToDo" is gone (a session can't be "to do").
  it('the footer offers only Done/Completed, never "mover p/ ToDo"', () => {
    const { getByText, queryByText } = render(<KanbanItemDrawer {...props} onPeek={noop} />);
    expect(getByText('Done')).toBeTruthy();
    expect(getByText('Completed')).toBeTruthy();
    expect(queryByText(/mover p\//i)).toBeNull();
  });

  it('picking Completed in the segmented control moves the session to done', () => {
    const onMove = vi.fn();
    const { getByText } = render(<KanbanItemDrawer {...props} onMove={onMove} onPeek={noop} />);
    getByText('Completed').click();
    expect(onMove).toHaveBeenCalledWith('a', 'done');
  });
});
