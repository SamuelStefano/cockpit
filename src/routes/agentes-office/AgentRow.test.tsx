// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { BotView } from '../equipe/team-view';
import { AgentRow } from './AgentRow';

afterEach(cleanup);

const view = {
  bot: { id: 'ana', name: 'ana', label: 'cargo ana', instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0 },
  key: 'ana', preview: '', unread: false, state: 'idle',
} as BotView;

describe('AgentRow', () => {
  it('wraps on phone so the name keeps a full line and the actions sit below', () => {
    const { container } = render(<AgentRow view={view} isLeader={false} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} />);
    expect(container.firstElementChild!.className).toContain('max-lg:flex-wrap');
    expect(screen.getByRole('button', { name: 'Perfil de ana' }).className).toContain('max-lg:basis-full');
    expect(screen.getByText('ana').className).toContain('truncate');
  });

  it('keeps the Workspace label for screen readers only on phone', () => {
    render(<AgentRow view={view} isLeader={false} onChat={vi.fn()} onWorkspace={vi.fn()} onProfile={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Workspace de ana' });
    expect(btn.querySelector('.max-lg\\:sr-only')?.textContent).toBe('Workspace');
  });
});
