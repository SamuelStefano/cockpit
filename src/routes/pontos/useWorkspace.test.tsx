// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { DflProjectNode } from '../../../shared/protocol';
import { sanitizeDrafts } from '../../../shared/dfl-drafts';
import { PontosControlsProvider, usePontosControlsState } from './pontosControls';
import { useWorkspace } from './useWorkspace';

const write = { onDflChange: async () => ({ ok: true }), onDflInvoice: async () => ({ ok: true }), onPontosAgent: async () => ({ ok: true }) };
function Wrapper({ children }: { children: ReactNode }) {
  return <PontosControlsProvider value={usePontosControlsState(write)}>{children}</PontosControlsProvider>;
}

const DRAFTS = sanitizeDrafts([
  { id: 'ep-a', title: 'A', status: 'created', createdAt: 0, tasks: [{ id: 't', title: 't', points: 1, refs: [] }] },
  { id: 'ep-b', title: 'B', status: 'draft', createdAt: 1, tasks: [{ id: 'u', title: 'u', points: 1, refs: [] }] },
]);
const PROJECTS: DflProjectNode[] = [{
  id: 'p', name: 'ITERA', points: 1, amountCents: 7500,
  epics: [{ id: 'e1', name: 'Melhorias', status: 'x', points: 1, amountCents: 7500, deliveries: [
    { id: 'd', name: 'D', status: 'x', pricePerPoint: 75, points: 1, amountCents: 7500, tasks: [{ id: 'k', name: 'k', points: 1, status: 'open', rawStatus: 'done', amountCents: 7500 }] },
  ] }],
}];

const mount = (drafts = DRAFTS, projects = PROJECTS) =>
  renderHook(({ d, p }) => useWorkspace(d, p), { wrapper: Wrapper, initialProps: { d: drafts, p: projects } });

describe('useWorkspace', () => {
  beforeEach(() => localStorage.clear());

  it('opens on the first pending draft, then on open DFL work, then on the invoices', () => {
    expect(mount().result.current.selection.draft?.id).toBe('ep-b');
    expect(mount([DRAFTS[0]]).result.current.selection.dfl?.epic.id).toBe('e1');
    expect(mount([], []).result.current.selection.view).toBe('faturas');
  });

  it('remembers the choice across mounts and falls back when it disappears', () => {
    const r = mount();
    act(() => r.result.current.select('dfl:e1'));
    expect(r.result.current.selection.dfl?.project.name).toBe('ITERA');
    expect(mount().result.current.selection.key).toBe('dfl:e1');
    r.rerender({ d: DRAFTS, p: [] });
    expect(r.result.current.selection.key).toBe('draft:ep-b');
  });

  it('selecting closes the phone drawer; search narrows the navigator only', () => {
    const r = mount();
    act(() => r.result.current.setDrawer(true));
    act(() => r.result.current.setQuery('melhor'));
    expect(r.result.current.nav.drafts).toHaveLength(0);
    expect(r.result.current.selection.draft?.id).toBe('ep-b');
    act(() => r.result.current.select('view:ledger'));
    expect(r.result.current.drawer).toBe(false);
    expect(r.result.current.selection.view).toBe('ledger');
  });
});
