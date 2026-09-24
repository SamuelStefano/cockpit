// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { FollowupChips } from './FollowupChips';

afterEach(cleanup);

describe('FollowupChips', () => {
  it('renders a repeated suggestion without a duplicate-key warning', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getAllByText } = render(<FollowupChips items={['Rodar testes', 'Rodar testes']} onPick={vi.fn()} onDismiss={vi.fn()} />);
    expect(getAllByText('Rodar testes')).toHaveLength(2);
    expect(err.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false);
    err.mockRestore();
  });
});
