// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { GraphQueryPanel } from './GraphQueryPanel';

afterEach(cleanup);

describe('GraphQueryPanel budget', () => {
  it('marks the chosen budget as pressed', () => {
    const { getByRole } = render(<GraphQueryPanel querying={false} result={null} history={[]} onQuery={vi.fn()} />);
    expect(getByRole('button', { name: 'média' }).getAttribute('aria-pressed')).toBe('true');
    const other = getByRole('button', { name: 'longa' });
    fireEvent.click(other);
    expect(other.getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: 'média' }).getAttribute('aria-pressed')).toBe('false');
  });
});
