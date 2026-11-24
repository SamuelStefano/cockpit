// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { BotView } from '../../routes/equipe/team-view';
import { TeamRoster } from './TeamRoster';

afterEach(cleanup);

const entry = (over: { label?: string; preview: string; state?: string }) => ({
  depth: 0,
  view: {
    bot: { id: 'b', name: 'Ana', label: over.label ?? '', instructions: '', mascot: 'bit', profile: 'full', createdAt: 0, updatedAt: 0 },
    state: over.state ?? 'idle', unread: false, key: 'b', preview: over.preview,
  } as unknown as BotView,
});

describe('TeamRoster', () => {
  it('shows the bot role under the name, never the last message', () => {
    render(<TeamRoster entries={[entry({ label: 'CTO', preview: 'Pode revisar o PR 12?' })]} activeId={null} onOpen={() => {}} />);
    expect(screen.getByText('CTO')).toBeTruthy();
    expect(screen.queryByText('Pode revisar o PR 12?')).toBeNull();
  });

  it('shows nothing under the name when the bot has no role', () => {
    render(<TeamRoster entries={[entry({ preview: 'Esperando você: aprovar deploy' })]} activeId={null} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ana' }).textContent).toBe('Ana');
  });

  it('keeps the role while the bot is working', () => {
    render(<TeamRoster entries={[entry({ label: 'QA', preview: 'rodando testes', state: 'working' })]} activeId={null} onOpen={() => {}} />);
    expect(screen.getByText('QA')).toBeTruthy();
    expect(screen.queryByText('rodando testes')).toBeNull();
  });
});
