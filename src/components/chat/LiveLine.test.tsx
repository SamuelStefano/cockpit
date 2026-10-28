// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { LiveLine } from './LiveLine';

afterEach(cleanup);

describe('LiveLine', () => {
  it('shows a working mascot beside the status phrase', () => {
    const { container } = render(<LiveLine />);
    expect(container.querySelector('svg.bit.bit-working')).toBeTruthy();
    expect(screen.getByRole('status').textContent?.length).toBeGreaterThan(0);
  });

  it('uses the agent avatar when given', () => {
    render(<LiveLine avatar={<span data-testid="av" />} />);
    expect(screen.getByTestId('av')).toBeTruthy();
  });
});
