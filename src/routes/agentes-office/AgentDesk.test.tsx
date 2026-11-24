// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BotView } from '../equipe/team-view';
import { AgentDesk } from './AgentDesk';

afterEach(cleanup);

const view = { bot: { id: 'a1', name: 'Téo', label: 'Tech Lead', mascot: { shape: 'drop', color: '#3b82f6' } }, key: 'a1', preview: '', unread: false, state: 'waiting' } as unknown as BotView;

describe('AgentDesk', () => {
  it('shows name, role, state label and the leader marker', () => {
    render(<AgentDesk view={view} isLeader onOpen={() => {}} />);
    expect(screen.getByText('Téo')).toBeTruthy();
    expect(screen.getByText('Tech Lead')).toBeTruthy();
    expect(screen.getByText('esperando você')).toBeTruthy();
    expect(screen.getByText('chefe')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'esperando você' })).toBeTruthy();
  });
  it('hides the marker for non-leaders and opens on click', () => {
    const onOpen = vi.fn();
    render(<AgentDesk view={view} isLeader={false} onOpen={onOpen} />);
    expect(screen.queryByText('chefe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Téo' }));
    expect(onOpen).toHaveBeenCalledWith('a1');
  });
});
