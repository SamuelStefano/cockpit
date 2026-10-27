// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ComposerStatusChips } from './ComposerStatusChips';

afterEach(cleanup);

describe('ComposerStatusChips', () => {
  it('renders nothing in the default mode without bypass', () => {
    const { container } = render(<ComposerStatusChips mode="auto" bypass={false} />);
    expect(container.textContent).toBe('');
  });

  it('shows the non-default mode', () => {
    render(<ComposerStatusChips mode="acceptEdits" bypass={false} />);
    expect(screen.getByText('Executar')).toBeTruthy();
  });

  it('always surfaces bypass', () => {
    render(<ComposerStatusChips mode="auto" bypass />);
    expect(screen.getByText('bypass')).toBeTruthy();
  });
});
