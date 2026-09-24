// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { CanvasTerms } from './useCanvasTerms';
import type { TermApi } from '../../useCockpit';
import { CanvasSurface } from './CanvasSurface';

afterEach(cleanup);

const term: TermApi = { attach: vi.fn(), detach: vi.fn(), input: vi.fn(), resize: vi.fn(), kill: vi.fn(), resume: vi.fn() };

const terms: CanvasTerms = {
  open: [], shells: [], active: null, focusN: 0, maximized: null, resuming: null, resumedLive: new Set(),
  openWindow: vi.fn(), openMany: vi.fn(), collapse: vi.fn(), kill: vi.fn(), newShell: vi.fn(), resume: vi.fn(),
  autoOpen: vi.fn(), focus: vi.fn(), blur: vi.fn(), setMaximized: vi.fn(),
};

const props = () => ({
  nodes: [], edges: [], pos: {}, bounds: { x: 0, y: 0, w: 0, h: 0 }, initialBounds: { x: 0, y: 0, w: 0, h: 0 },
  selected: [], running: new Set<string>(), waiting: new Set<string>(), centerRequest: null,
  onSelect: vi.fn(), onClear: vi.fn(), onDrop: vi.fn(), onResetLayout: vi.fn(),
  windows: new Set<string>(), terms, term, onOpenChat: vi.fn(), onOpenRecent: vi.fn(), onOpenTerm: vi.fn(),
  onSendTo: vi.fn(() => true), sendError: null, onDismissSendError: vi.fn(),
  stats: {}, analysisOn: false, onToggleAnalysis: vi.fn(),
  flows: [], flowFired: {}, onFlowCreate: vi.fn(), onFlowClick: vi.fn(),
  areaRects: [], budgetStatus: {}, onEditBudget: vi.fn(),
  pastAlive: null, timelinePlaying: false, orchestrator: undefined,
});

describe('CanvasSurface scroll defensiveness', () => {
  // Root cause (canvas review #620 item 4): `overflow-hidden` still lets a
  // programmatic scroll (e.g. a background terminal's textarea.focus()) move
  // scrollTop/scrollLeft and drag every absolutely-positioned overlay with
  // it. `overflow-clip` truly can't scroll, but jsdom doesn't model layout —
  // it happily lets scrollTop be set no matter the CSS overflow value — so
  // the only thing actually verifiable here, and the real second line of
  // defence in a browser too, is the onScroll handler snapping it back.
  it('resets scrollTop/scrollLeft to 0 on any scroll event', () => {
    const { container } = render(<CanvasSurface {...props()} />);
    const root = container.firstElementChild as HTMLElement;
    root.scrollTop = 514;
    root.scrollLeft = 297;
    fireEvent.scroll(root);
    expect(root.scrollTop).toBe(0);
    expect(root.scrollLeft).toBe(0);
  });

  it('uses overflow-clip, not overflow-hidden, on the root', () => {
    const { container } = render(<CanvasSurface {...props()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('overflow-clip');
    expect(root.className).not.toContain('overflow-hidden');
  });
});
