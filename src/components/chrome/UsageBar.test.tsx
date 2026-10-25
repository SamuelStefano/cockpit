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

  it('names the compact meter by what it measures and says it opens a panel', () => {
    render(<UsageBar usage={usage} compact />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    expect(btn.getAttribute('aria-label')).toMatch(/^Uso do plano: \d+%/);
  });

  it('labels the chip Grok and lists the other account in the panel', () => {
    const grok: PlanUsage = { fiveHour: 42, sevenDay: 42, resetsAt: null, sevenDayResetsAt: null, limits: [{ id: 'grok-credits', label: 'Créditos do período', pct: 42, resetsAt: null, severity: 'normal', scoped: false }] };
    render(<UsageBar usage={grok} compact={false} agent="grok" secondary={{ title: 'Claude', rows: [{ id: 'five-hour', label: 'Sessão (5h)', pct: 19, resetsAt: null, tone: 'ok', scoped: false }] }} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/^Uso do Grok: 42%/);
    expect(btn.textContent).toContain('Grok');
    fireEvent.click(btn);
    const panel = screen.getByRole('dialog');
    expect(panel.textContent).toContain('Créditos do período');
    expect(panel.textContent).toContain('Claude');
    expect(panel.textContent).toContain('Sessão (5h)');
  });

  it('Grok with no number shows a dash, not a percentage', () => {
    render(<UsageBar usage={null} compact={false} agent="grok" />);
    expect(screen.getByRole('button').textContent).toContain('—');
  });
});
