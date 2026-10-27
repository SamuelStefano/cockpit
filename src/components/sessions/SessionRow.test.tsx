// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { SessionRow } from './SessionRow';
import type { Session } from '../../data/types';

afterEach(cleanup);

const s: Session = {
  id: 'a', title: 'Nova sessão', relative: 'há 3m', snippet: 'Pegue o contexto',
  mtime: Date.now(), hasTerminal: false, active: false,
};

const row = (props: Partial<Parameters<typeof SessionRow>[0]> = {}) =>
  render(<SessionRow s={s} active={false} onSelect={() => {}} onRename={() => {}} onClose={() => {}} {...props} />).container;

describe('SessionRow', () => {
  it('shows the title and nothing else: no snippet, no time', () => {
    row();
    expect(screen.getByText('Nova sessão')).toBeTruthy();
    expect(screen.queryByText('há 3m')).toBeNull();
    expect(screen.queryByText('Pegue o contexto')).toBeNull();
  });

  it('running: green dot', () => {
    const c = row({ running: true, runStart: Date.now() - 65_000 });
    expect(c.querySelectorAll('.bg-green-400').length).toBe(1);
  });

  it('stalled: amber dot', () => {
    const c = row({ running: true, stalled: true, runStart: Date.now() - 3_000 });
    expect(c.querySelectorAll('.bg-amber-400').length).toBe(1);
  });

  it('waiting: violet dot', () => {
    const c = row({ s: { ...s, waiting: true } });
    expect(c.querySelectorAll('.bg-violet-400').length).toBe(1);
  });

  it('idle with new output: single orange dot', () => {
    const c = row({ updated: true });
    expect(c.querySelectorAll('.bg-orange-400').length).toBe(1);
  });

  it('idle without signals: no dot at all', () => {
    const c = row();
    expect(c.querySelector('.rounded-full.h-1\\.5')).toBeNull();
  });

  it('the card is not a button around other controls; the title is the button', () => {
    const c = row({ active: true });
    const card = c.firstElementChild as HTMLElement;
    expect(card.getAttribute('role')).toBeNull();
    const title = screen.getByRole('button', { name: /Nova sessão/ });
    expect(title.getAttribute('aria-current')).toBe('true');
    expect(card.contains(title)).toBe(true);
  });

  it('activating the title selects the session', () => {
    const onSelect = vi.fn();
    row({ onSelect });
    fireEvent.click(screen.getByRole('button', { name: /Nova sessão/ }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });
});
