// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { KanbanDock } from './KanbanDock';
import { KANBAN_STALE_MS, type SessionKanbanItem } from './kanban-items';

afterEach(cleanup);

// Regression for #598: 34 sessions in scope, zero explicit task cards — the
// folded strip used to read cards.length only and print "0" in every column.
// mtime defaults to "now" (fresh, never triaged away) — a test that wants a
// stale item passes its own mtime explicitly.
function sessionItem(id: string, status: SessionKanbanItem['status'], mtime = Date.now()): SessionKanbanItem {
  return {
    nodeId: `s:${id}`, sessionId: id, title: `sessão ${id}`, subtitle: 'trabalho real', orchestratorChild: false,
    status, running: status === 'doing', waitingOnUser: false, needsAttention: false, mtime,
  };
}

describe('KanbanDock', () => {
  it('counts sessions alongside cards in the folded header', () => {
    const sessionItems: SessionKanbanItem[] = [
      sessionItem('running-1', 'doing'),
      sessionItem('waiting-1', 'todo'),
      sessionItem('done-1', 'review'),
      sessionItem('done-2', 'review'),
      sessionItem('confirmed-1', 'done'),
    ];
    const { container } = render(
      <KanbanDock cards={[]} sessionItems={sessionItems} open={false} onToggle={() => {}}>
        <div />
      </KanbanDock>,
    );
    const text = container.textContent ?? '';
    // Each status label is followed by its Badge count — assert the columns
    // aren't all "0" despite 5 sessions in scope.
    expect(text).not.toMatch(/todo.?0.*doing.?0.*done.?0/i);
    const badgeCounts = [...container.querySelectorAll('span')]
      .map((el) => el.textContent?.trim())
      .filter((t) => /^\d+$/.test(t ?? ''));
    const total = badgeCounts.reduce((sum, t) => sum + Number(t), 0);
    expect(total).toBe(sessionItems.length);
  });

  it('reads all zero when there really are no cards or sessions', () => {
    const { container } = render(
      <KanbanDock cards={[]} sessionItems={[]} open={false} onToggle={() => {}}>
        <div />
      </KanbanDock>,
    );
    const badgeCounts = [...container.querySelectorAll('span')]
      .map((el) => el.textContent?.trim())
      .filter((t) => /^\d+$/.test(t ?? ''));
    expect(badgeCounts.every((t) => t === '0')).toBe(true);
  });

  // canvas review item 2: the flood bug — strip read "Done 251" while the
  // open column read "Done 43" off the SAME board. Same triage, same numbers.
  it('the Done count matches triageSessionItems.visible, not every untriaged item', () => {
    const old = Date.now() - KANBAN_STALE_MS - 1;
    const items: SessionKanbanItem[] = [
      sessionItem('fresh-1', 'review'),
      sessionItem('fresh-2', 'review'),
      ...Array.from({ length: 5 }, (_, i) => sessionItem(`stale-${i}`, 'review', old)),
    ];
    const { getByText } = render(
      <KanbanDock cards={[]} sessionItems={items} open={false} onToggle={() => {}}><div /></KanbanDock>,
    );
    expect(getByText('2')).toBeTruthy(); // the "Done" badge — only the 2 fresh ones
    expect(getByText('+5 antigos')).toBeTruthy();
  });

  it('a non-Done stale item is dropped from the count entirely (hiddenIdle), not folded into antigos', () => {
    const old = Date.now() - KANBAN_STALE_MS - 1;
    const items: SessionKanbanItem[] = [sessionItem('stale-todo', 'todo', old)];
    const { queryByText } = render(
      <KanbanDock cards={[]} sessionItems={items} open={false} onToggle={() => {}}><div /></KanbanDock>,
    );
    expect(queryByText(/antigos/)).toBeNull();
  });

  it('respects hiddenSessionIds the same way the open column does', () => {
    const items: SessionKanbanItem[] = [sessionItem('a', 'review'), sessionItem('b', 'review')];
    const { getByText } = render(
      <KanbanDock cards={[]} sessionItems={items} hiddenSessionIds={new Set(['a'])} open={false} onToggle={() => {}}><div /></KanbanDock>,
    );
    expect(getByText('1')).toBeTruthy();
  });
});
