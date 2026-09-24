// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { KanbanSessionItem } from './KanbanSessionItem';
import type { SessionKanbanItem } from './kanban-items';

afterEach(cleanup);

const base: SessionKanbanItem = {
  nodeId: 's:a', sessionId: 'a', title: 'sessão a', subtitle: 'primeira mensagem', orchestratorChild: false,
  status: 'review', running: false, waitingOnUser: false, needsAttention: false, mtime: Date.now() - 7 * 60_000,
};
const noop = () => {};

describe('KanbanSessionItem', () => {
  // canvas review item 5: bulk triage + the drawer cover completion now.
  it('never renders a per-item complete button', () => {
    const { queryByText } = render(<KanbanSessionItem item={base} selected={false} onSelect={noop} onOpenSession={noop} onOpenTerm={noop} />);
    expect(queryByText(/marcar completo/i)).toBeNull();
  });

  // canvas review item 6: relPast(mtime) === 'agora' must never read "parada há agora".
  it('a session touched under a minute ago never says "parada há agora"', () => {
    const item = { ...base, mtime: Date.now() - 1000 };
    const { container } = render(<KanbanSessionItem item={item} selected={false} onSelect={noop} onOpenSession={noop} onOpenTerm={noop} />);
    expect(container.textContent).not.toMatch(/parada há agora/i);
  });

  it('a running item reads "ativa agora", not the stopped phrasing', () => {
    const item = { ...base, running: true, status: 'doing' as const };
    const { getByText } = render(<KanbanSessionItem item={item} selected={false} onSelect={noop} onOpenSession={noop} onOpenTerm={noop} />);
    expect(getByText('ativa agora')).toBeTruthy();
  });

  it('needsAttention outranks waitingOnUser and running for the single status badge', () => {
    const item = { ...base, running: true, waitingOnUser: true, needsAttention: true };
    const { getByText, queryByText } = render(<KanbanSessionItem item={item} selected={false} onSelect={noop} onOpenSession={noop} onOpenTerm={noop} />);
    expect(getByText('precisa de atenção')).toBeTruthy();
    expect(queryByText('esperando você')).toBeNull();
    expect(queryByText('rodando')).toBeNull();
  });

  it('clicking the row calls onSelect with the node id', () => {
    const onSelect = vi.fn();
    const { container } = render(<KanbanSessionItem item={base} selected={false} onSelect={onSelect} onOpenSession={noop} onOpenTerm={noop} />);
    (container.firstChild as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith('s:a');
  });

  it('opens the drawer with Enter or Space, but not from the inner buttons', () => {
    const onSelect = vi.fn();
    const { container, getByTitle } = render(<KanbanSessionItem item={base} selected={false} onSelect={onSelect} onOpenSession={noop} onOpenTerm={noop} />);
    const item = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(item, { key: 'Enter' });
    fireEvent.keyDown(item, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(getByTitle('abrir chat'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('hidden action buttons do not catch taps', () => {
    const { getByTitle } = render(<KanbanSessionItem item={base} selected={false} onSelect={noop} onOpenSession={noop} onOpenTerm={noop} />);
    expect(getByTitle('abrir chat').parentElement!.className).toContain('pointer-events-none');
  });
});
