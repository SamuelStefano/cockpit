// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrgList, flattenOrg } from './OrgList';
import { buildOrgTree } from './org-tree';
import type { BotView } from './team-view';

const view = (id: string, parentId?: string, extra: Partial<BotView> = {}): BotView => ({
  bot: { id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#60a5fa' }, profile: 'full', createdAt: 0, updatedAt: 0, parentId },
  state: 'idle', preview: '', pending: false, startedAt: undefined, ...extra,
} as unknown as BotView);

describe('OrgList', () => {
  it('flattens with depth per hierarchy level', () => {
    const rows = flattenOrg(buildOrgTree([view('a'), view('b', 'a'), view('c', 'b')]));
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2]);
  });

  it('opens the agent on tap', () => {
    const onOpen = vi.fn();
    render(<OrgList views={[view('a'), view('b', 'a')]} onOpen={onOpen} />);
    fireEvent.click(screen.getByLabelText('Abrir b'));
    expect(onOpen).toHaveBeenCalledWith('b');
  });
});

describe('OrgList paused', () => {
  it('rests every mascot and says so when the team is paused', () => {
    render(<OrgList views={[view('a', undefined, { state: 'working' })]} onOpen={() => {}} paused />);
    expect(screen.getByText('Em pausa')).toBeTruthy();
  });

  it('highlights a bot waiting on you', () => {
    render(<OrgList views={[view('a', undefined, { pending: true })]} onOpen={() => {}} />);
    expect(screen.getByText('Esperando você').className).toContain('text-orange-300');
  });
});
