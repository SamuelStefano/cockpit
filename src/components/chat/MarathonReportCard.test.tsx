// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { MarathonReportCard } from './MarathonReportCard';

afterEach(cleanup);

describe('MarathonReportCard', () => {
  it('summarises duration, turns and PRs, and can be dismissed', () => {
    const onDismiss = vi.fn();
    const run = { start: 0, lastActive: 130 * 60_000, turns: 7, running: false, dismissed: false };
    render(<MarathonReportCard run={run} prs={3} onDismiss={onDismiss} />);
    expect(screen.getByRole('status').textContent).toContain('2h 10min · 7 turnos · 3 PRs');
    fireEvent.click(screen.getByText('Fechar'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
