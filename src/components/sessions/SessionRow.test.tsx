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
  it('shows the title on one line, no time and no snippet', () => {
    const c = row();
    const title = screen.getByText('Nova sessão');
    expect(title.className).toContain('truncate');
    expect(title.className).not.toContain('line-clamp');
    expect(c.querySelector('[data-row-meta]')).toBeNull();
    expect(screen.queryByText('há 3m')).toBeNull();
    expect(title.parentElement?.className).toContain('text-[14px]');
    expect(screen.queryByText('Pegue o contexto')).toBeNull();
  });

  it('active row gets a soft neutral background and no orange bar', () => {
    const c = row({ active: true });
    const el = c.firstElementChild as HTMLElement;
    expect(el.className).not.toContain('bg-orange');
    expect(el.className).not.toContain('before:');
    expect(el.className).toContain('bg-neutral-800/90');
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

  it('idle with new output: no dot', () => {
    const c = row({ updated: true });
    expect(c.querySelectorAll('.bg-orange-400').length).toBe(0);
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
