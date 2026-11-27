// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NpcDialog } from './NpcDialog';
import { initialTalk } from './world/talk-state';
import type { TeamBot } from '../../../shared/protocol';

const bot = { id: 'a', name: 'Ada', label: 'Ops', instructions: '', mascot: { shape: 'blob', color: '#3fd17f' }, profile: 'full', createdAt: 0, updatedAt: 0 } as TeamBot;
const snap = { redacted: false as const, botId: 'a', name: 'Ada', label: 'Ops', state: 'working' as const, task: 'Fix the deploy', prs: [], needs: [], at: 1 };
const noop = () => {};

import { afterEach } from 'vitest';
afterEach(cleanup);

describe('NpcDialog', () => {
  it('shows the task and enables Conversar', () => {
    render(<NpcDialog bot={bot} talk={{ ...initialTalk, botId: 'a', snapshot: snap }} recording={false} following={false} side="bottom" onSend={noop} onOpenPc={noop} onFollow={noop} onClose={noop} />);
    expect(screen.getByText('Fix the deploy')).toBeTruthy();
    expect((screen.getByText('Conversar') as HTMLButtonElement).disabled).toBe(false);
  });
  it('hides the task and blocks chat while recording', () => {
    const redacted = { redacted: true as const, botId: 'a', name: 'Ada', state: 'working' as const, openPrs: 1, mergedPrs: 2, needs: 0, at: 1 };
    render(<NpcDialog bot={bot} talk={{ ...initialTalk, botId: 'a', snapshot: redacted }} recording following={false} side="bottom" onSend={noop} onOpenPc={noop} onFollow={noop} onClose={noop} />);
    expect(screen.queryByText('Fix the deploy')).toBeNull();
    expect((screen.getByText('Conversar') as HTMLButtonElement).disabled).toBe(true);
  });
  it('blocks chat for a bot without a session and closes on Escape', () => {
    const onClose = vi.fn();
    render(<NpcDialog bot={bot} talk={{ ...initialTalk, botId: 'a', snapshot: { ...snap, state: 'no-session' } }} recording={false} following={false} side="bottom" onSend={noop} onOpenPc={noop} onFollow={noop} onClose={onClose} />);
    expect((screen.getByText('Conversar') as HTMLButtonElement).disabled).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
  });
  it('keeps the form and buttons outside the scrolling region', () => {
    const { container } = render(<NpcDialog bot={bot} talk={{ ...initialTalk, botId: 'a', snapshot: snap, reply: 'hello' }} recording={false} following={false} side="bottom" onSend={noop} onOpenPc={noop} onFollow={noop} onClose={noop} />);
    fireEvent.click(screen.getByText('Conversar'));
    const root = container.querySelector('[data-npc-dialog]') as HTMLElement;
    const scroller = root.querySelector('[data-npc-scroll]') as HTMLElement;
    const form = root.querySelector('form') as HTMLElement;
    const actions = root.querySelector('[data-npc-actions]') as HTMLElement;
    expect(scroller.className).toContain('overflow-y-auto');
    expect(scroller.className).toContain('min-h-0');
    expect(scroller.className).toContain('flex-1');
    expect(scroller.contains(root.querySelector('[data-npc-reply]'))).toBe(true);
    expect(scroller.contains(form)).toBe(false);
    expect(scroller.contains(actions)).toBe(false);
    expect(form.className).toContain('shrink-0');
    expect(actions.className).toContain('shrink-0');
    expect(root.style.maxHeight).toContain('min(70%');
  });
});
