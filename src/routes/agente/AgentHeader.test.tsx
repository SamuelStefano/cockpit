// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TeamBot } from '../../../shared/protocol';
import { AgentHeader, agentSubtitle } from './AgentHeader';

afterEach(cleanup);

const bot = (id: string, over: Partial<TeamBot> = {}): TeamBot => ({ id, name: id, label: `cargo ${id}`, instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over });

describe('AgentHeader', () => {
  it('builds the meta line from sector, model and team relations', () => {
    const lead = bot('lead', { department: 'engineering', model: 'sonnet' });
    expect(agentSubtitle(lead, [lead, bot('wk', { parentId: 'lead' })])).toBe('Engenharia · sonnet · coordena wk');
  });

  it('shows the role, the status badge and a primary Chat button', () => {
    const onChat = vi.fn();
    render(<AgentHeader bot={bot('a')} bots={[]} state="waiting" onChat={onChat} onBack={vi.fn()} />);
    expect(screen.getByText('cargo a')).toBeTruthy();
    expect(screen.getByText('esperando você')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(onChat).toHaveBeenCalled();
  });
});
