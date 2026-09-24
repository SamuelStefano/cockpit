// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { CanvasNode } from '../../../shared/canvas';
import { CanvasChain, CHAIN_LIST_INDENT } from './CanvasChain';

beforeEach(() => {
  // <=640px: the narrow indented-list fallback.
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const session = (i: number, parent?: number): CanvasNode => ({
  id: `s:u${i}`, kind: 'session', ref: `u${i}`, title: `fork ${i}`, subtitle: '', mtime: 1000 - i, area: 'dfl',
  ...(parent !== undefined ? { parentSessionId: `u${parent}` } : {}),
});

describe('CanvasChain narrow list', () => {
  it('indents one fixed step per level instead of compounding the margin', () => {
    const nodes = [session(0), session(1, 0), session(2, 1), session(3, 2), session(4, 3)];
    const { getByText } = render(
      <CanvasChain nodes={nodes} flows={[]} running={new Set()} waiting={new Set()} stats={{}} onOpenTerm={vi.fn()} onOpenChat={vi.fn()} />,
    );
    // Walk from the deepest row up to the list root, summing every margin.
    let el: HTMLElement | null = getByText('fork 4');
    let total = 0;
    while (el && !el.classList.contains('overflow-y-auto')) {
      total += parseFloat(el.style.marginLeft || '0');
      el = el.parentElement;
    }
    // root(orchestrator) > area > fork 0 > 1 > 2 > 3 > 4 = 6 nested levels.
    expect(total).toBe(6 * CHAIN_LIST_INDENT);
  });
});
