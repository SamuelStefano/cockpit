// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { KanbanDock } from './KanbanDock';
import type { SessionKanbanItem } from './kanban-items';

afterEach(cleanup);

// Regression for #598: 34 sessions in scope, zero explicit task cards — the
// folded strip used to read cards.length only and print "0" in every column.
function sessionItem(id: string, status: SessionKanbanItem['status']): SessionKanbanItem {
  return {
    nodeId: `s:${id}`, sessionId: id, title: `sessão ${id}`, subtitle: 'trabalho real', orchestratorChild: false,
    status, running: status === 'doing', waitingOnUser: false, needsAttention: false, mtime: 10,
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
});
