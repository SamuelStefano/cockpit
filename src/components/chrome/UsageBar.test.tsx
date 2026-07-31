// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { UsageBar } from './UsageBar';
import type { PlanUsage } from '../../../shared/protocol';

const usage: PlanUsage = {
  fiveHour: 19,
  sevenDay: 76,
  resetsAt: null,
  sevenDayResetsAt: null,
  limits: [
    { id: 'session-0', label: 'Sessão (5h)', pct: 19, resetsAt: null, severity: 'normal', scoped: false },
    { id: 'weekly_all-1', label: 'Semanal', pct: 76, resetsAt: null, severity: 'warning', scoped: false },
    { id: 'weekly_scoped-2', label: 'Fable', pct: 4, resetsAt: null, severity: 'normal', scoped: true },
  ],
};

describe('UsageBar', () => {
  afterEach(cleanup);

  it('shows only the 5h number until clicked', () => {
    render(<UsageBar usage={usage} compact={false} />);
    expect(screen.getByText('19%')).toBeTruthy();
    expect(screen.queryByText('Semanal')).toBeNull();
  });

  it('reveals the weekly and per-model caps on click', () => {
    render(<UsageBar usage={usage} compact={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Semanal')).toBeTruthy();
    expect(screen.getByText('76%')).toBeTruthy();
    expect(screen.getByText('Fable')).toBeTruthy();
    expect(screen.getByText('4%')).toBeTruthy();
  });

  it('closes on a second click', () => {
    render(<UsageBar usage={usage} compact={false} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByText('Fable')).toBeNull();
  });

  it('still opens before the first poll, saying it is reading', () => {
    render(<UsageBar usage={null} compact={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Lendo da conta…')).toBeTruthy();
  });
});
