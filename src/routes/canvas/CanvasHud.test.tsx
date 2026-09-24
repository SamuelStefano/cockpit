// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CanvasHud } from './CanvasHud';
import type { SessionKanbanItem } from './kanban-items';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const item = (i: number): SessionKanbanItem => ({
  nodeId: `s:${i}`, sessionId: `${i}`, title: `session ${i}`, subtitle: '', orchestratorChild: false,
  status: 'doing', running: true, waitingOnUser: false, needsAttention: false, mtime: i,
});

describe('CanvasHud', () => {
  it('caps its height above the bottom toolbar and scrolls the roster instead of running under it', () => {
    const { getByText } = render(<CanvasHud items={[1, 2, 3, 4, 5, 6, 7].map(item)} onPick={vi.fn()} />);
    const roster = getByText('session 7').closest('div.overflow-y-auto');
    expect(roster).not.toBeNull();
    expect(roster!.className).toContain('min-h-0');
    const shell = roster!.parentElement!;
    expect(shell.className).toMatch(/max-h-\[calc\(100%-5rem\)\]/);
    expect(shell.className).toContain('flex-col');
  });

  it('says so when nothing is alive instead of opening an empty box', () => {
    const { getByText } = render(<CanvasHud items={[]} onPick={vi.fn()} />);
    expect(getByText('nenhuma sessão viva agora')).toBeTruthy();
  });
});
