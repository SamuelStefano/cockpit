// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
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
  it('active row keeps the orange ring regardless of its group', () => {
    const cls = (row({ active: true }).firstElementChild as HTMLElement).className;
    expect(cls).toContain('border-orange-500/40');
    expect(cls).toContain('glow-active');
  });

  it('running: green dot and elapsed time in the footer, no extra line', () => {
    row({ running: true, runStart: Date.now() - 65_000 });
    expect(screen.getByText(/^trabalhando · 1m/)).toBeTruthy();
    expect(screen.queryByText('há 3m')).toBeNull();
  });

  it('stalled: amber footer', () => {
    row({ running: true, stalled: true, runStart: Date.now() - 3_000 });
    expect(screen.getByText(/^sem resposta/).className).toContain('text-amber-400');
  });

  it('waiting: violet footer keeps the relative time', () => {
    row({ s: { ...s, waiting: true } });
    expect(screen.getByText('aguarda você · há 3m').className).toContain('text-violet-300');
  });

  it('idle with new output: single orange dot, neutral footer', () => {
    const c = row({ updated: true });
    expect(c.querySelectorAll('.bg-orange-400').length).toBe(1);
    expect(screen.getByText('há 3m')).toBeTruthy();
  });

  it('idle without signals: no dot at all', () => {
    const c = row();
    expect(c.querySelector('.rounded-full.h-1\\.5')).toBeNull();
  });
});
