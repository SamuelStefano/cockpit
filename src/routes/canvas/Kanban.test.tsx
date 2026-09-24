// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { Kanban } from './Kanban';
import type { SessionKanbanItem } from './kanban-items';

afterEach(cleanup);

const item = (id: string, extra: Partial<SessionKanbanItem> = {}): SessionKanbanItem => ({
  nodeId: `s:${id}`, sessionId: id, title: `sessão ${id}`, subtitle: '', status: 'review', orchestratorChild: false,
  running: false, waitingOnUser: false, needsAttention: false, mtime: Date.now(), ...extra,
});
const noop = () => {};
const baseProps = {
  cards: [], termStats: {}, selected: [], running: new Set<string>(), sessionsOf: () => [], nodeOf: () => undefined,
  onSelect: noop, onSelectSession: noop, onMove: noop, onRun: noop, onEdit: noop, onOpenSession: noop, onOpenTerm: noop,
  onSessionStatus: noop, hiddenSessionIds: new Set<string>(), onHideSession: noop, onUnhideAll: noop,
  sessionPeeks: {}, onSessionPeek: noop,
};

describe('Kanban — "completar antigos (N)" bulk triage (canvas review item 2)', () => {
  const STALE = Date.now() - 25 * 3600_000; // over the 24h threshold

  it('uses the ONE bulk frame when onSessionStatusBulk is wired', () => {
    const onSessionStatusBulk = vi.fn();
    const onSessionStatus = vi.fn();
    const items = [item('old-1', { mtime: STALE }), item('old-2', { mtime: STALE })];
    const { getByText } = render(
      <Kanban {...baseProps} sessionItems={items} onSessionStatus={onSessionStatus} onSessionStatusBulk={onSessionStatusBulk} />,
    );
    fireEvent.click(getByText(/completar antigos \(2\)/));
    expect(onSessionStatusBulk).not.toHaveBeenCalled();
    fireEvent.click(getByText('marcar 2 como concluídas?'));
    expect(onSessionStatusBulk).toHaveBeenCalledWith(['old-1', 'old-2'], 'done');
    expect(onSessionStatus).not.toHaveBeenCalled();
  });

  it('falls back to one onSessionStatus call per id when no bulk callback is wired', () => {
    const onSessionStatus = vi.fn();
    const items = [item('old-1', { mtime: STALE }), item('old-2', { mtime: STALE })];
    const { getByText } = render(<Kanban {...baseProps} sessionItems={items} onSessionStatus={onSessionStatus} />);
    fireEvent.click(getByText(/completar antigos \(2\)/));
    fireEvent.click(getByText('marcar 2 como concluídas?'));
    expect(onSessionStatus).toHaveBeenCalledWith('old-1', 'done');
    expect(onSessionStatus).toHaveBeenCalledWith('old-2', 'done');
  });

  it('the antigos chip and count sit in the Done header, reachable without opening the list first', () => {
    const items = [item('old-1', { mtime: STALE })];
    const { getByText } = render(<Kanban {...baseProps} sessionItems={items} />);
    expect(getByText('1 antigos')).toBeTruthy();
  });
});

describe('Kanban — empty column collapse (item 5)', () => {
  it('an empty column still renders its name and a 0 count (collapsed rail on desktop)', () => {
    const { getAllByText } = render(<Kanban {...baseProps} sessionItems={[]} />);
    // ToDo/In progress/Done/Completed all empty — every one renders its label
    // twice (mobile header + desktop rail), both present in the DOM.
    expect(getAllByText('ToDo').length).toBeGreaterThan(0);
  });
});

describe('Kanban — mobile column switcher (item 11)', () => {
  it('only the selected status column is visible (not hidden) at a time', () => {
    const { container, getByText } = render(<Kanban {...baseProps} sessionItems={[item('a', { status: 'doing' })]} />);
    const sections = container.querySelectorAll('section');
    const visible = [...sections].filter((s) => !s.className.includes('hidden'));
    expect(visible).toHaveLength(1);
    // Default lands on "In progress" — switch to "Done" via the segmented
    // control. fireEvent (not a raw .click()) so the re-render is flushed
    // before the DOM is read back below.
    fireEvent.click(getByText(/Done ·/));
    const visibleAfter = [...container.querySelectorAll('section')].filter((s) => !s.className.includes('hidden'));
    expect(visibleAfter).toHaveLength(1);
    expect(visibleAfter[0]).not.toBe(visible[0]);
  });
});

describe('Kanban — session item actions (no per-item complete button, item 5)', () => {
  it('opens the drawer on click instead of a dedicated complete button', () => {
    const items = [item('a', { status: 'doing' })];
    const { container, queryByText } = render(<Kanban {...baseProps} sessionItems={items} />);
    expect(queryByText(/marcar completo/i)).toBeNull();
    fireEvent.click(within(container).getByText('sessão a'));
    expect(within(container).getByText('terminal')).toBeTruthy(); // drawer footer
  });
});

describe('Kanban — session drops follow the drawer rule', () => {
  const drop = (section: Element, sessionId: string) => fireEvent.drop(section, {
    dataTransfer: { getData: (t: string) => (t === 'text/deck-session' ? sessionId : '') },
  });

  it('ignores a session dropped on To do / In progress, accepts review and done', () => {
    const onSessionStatus = vi.fn();
    const { container } = render(<Kanban {...baseProps} onSessionStatus={onSessionStatus} sessionItems={[item('x')]} />);
    const sections = container.querySelectorAll('section');
    for (const s of sections) drop(s, 'x');
    const statuses = onSessionStatus.mock.calls.map((c) => c[1]);
    expect(statuses).not.toContain('todo');
    expect(statuses).not.toContain('doing');
    expect(statuses).toEqual(expect.arrayContaining(['review', 'done']));
  });
});

describe('Kanban — empty columns', () => {
  it('collapses an empty column to a rail only when another column has content', () => {
    const { container } = render(<Kanban {...baseProps} sessionItems={[item('a', { status: 'doing', running: true })]} />);
    const rails = [...container.querySelectorAll('section')].filter((s) => s.className.includes('md:w-11'));
    expect(rails).toHaveLength(3);
  });

  it('keeps full columns (not four rails on a blank board) when every column is empty', () => {
    const { container, getAllByText } = render(<Kanban {...baseProps} sessionItems={[]} />);
    const sections = [...container.querySelectorAll('section')];
    expect(sections).toHaveLength(4);
    for (const s of sections) expect(s.className).toContain('md:flex-1');
    expect(getAllByText('nada por aqui')).toHaveLength(4);
    for (const p of getAllByText('nada por aqui')) expect(p.parentElement?.className).not.toContain('md:hidden');
  });
});

describe('Kanban — column headers', () => {
  it('keeps the Done header as tall as the others when the "antigos" chip shows', () => {
    const STALE = Date.now() - 25 * 3600_000;
    const { getByText } = render(<Kanban {...baseProps} sessionItems={[item('old', { mtime: STALE })]} />);
    expect(getByText(/1 antigos/).closest('button')?.className).toContain('-my-1.5');
  });
});
