// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { StreakBadge } from './StreakBadge';

afterEach(cleanup);

describe('StreakBadge', () => {
  it('shows the day count with the tally as its label', () => {
    render(<StreakBadge streak={6} turns={14} />);
    expect(screen.getByLabelText('6 dias seguidos · 14 turnos hoje').textContent).toBe('6');
  });

  it('renders nothing without a streak', () => {
    const { container } = render(<StreakBadge streak={0} turns={0} />);
    expect(container.firstChild).toBeNull();
  });
});
