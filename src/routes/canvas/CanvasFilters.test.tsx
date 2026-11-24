// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CanvasFilters } from './CanvasFilters';

afterEach(cleanup);

const noop = vi.fn();

describe('CanvasFilters status chips', () => {
  it('grow to a finger-sized target on a coarse pointer, zero chips included', () => {
    const { getByText } = render(
      <CanvasFilters
        mode="canvas" onMode={noop} scope="exec" onScope={noop} archived={false} onArchived={noop}
        showAutomation={false} onShowAutomation={noop} showContexts={false} onShowContexts={noop}
        query="" onQuery={noop} loading={false} onRefresh={noop} onNewCard={noop}
        counts={{ sessions: 0, contexts: 0, terminals: 0, cards: 0, hotContext: 0, conflicts: 0 }}
        areaCounts={[]} areaFilter={null} onAreaFilter={noop}
        statusSummary={{ running: { count: 2, firstNodeId: 's:a' }, waiting: { count: 0 }, errored: { count: 0 }, doneRecent: { count: 1, firstNodeId: 's:b' } }}
        onFocusStatusItem={noop}
      />,
    );
    const running = getByText(/2 rodando/).closest('button')!;
    expect(running.className).toContain('pointer-coarse:py-2');
    const waiting = getByText(/0 esperando você/);
    expect(waiting.className).toContain('pointer-coarse:py-2');
  });
});
