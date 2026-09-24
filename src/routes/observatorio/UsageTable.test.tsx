// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { UsageTable, USAGE_PAGE } from './UsageTable';

afterEach(cleanup);

const rows = [
  { sessionId: 'a', ctxTokens: 1, outputTokens: 10, samples: 1, lastTs: 1, model: null, requestedModel: null, costUsd: 1 },
  { sessionId: 'b', ctxTokens: 1, outputTokens: 20, samples: 1, lastTs: 2, model: null, requestedModel: null, costUsd: 2 },
] as never;

describe('UsageTable sort headers', () => {
  it('keeps focus on the header button after sorting, and exposes aria-sort', () => {
    const { getByText } = render(<UsageTable rows={rows} known={new Set()} titleOf={(id) => id} onOpenSession={() => {}} />);
    const btn = getByText('saída').closest('button')!;
    btn.focus();
    fireEvent.click(btn);
    expect(document.activeElement).toBe(getByText('saída').closest('button'));
    expect(btn.closest('th')!.getAttribute('aria-sort')).toBe('descending');
  });
});

describe('UsageTable paging', () => {
  it('renders one page and grows on "ver mais"', () => {
    const many = Array.from({ length: USAGE_PAGE + 7 }, (_, i) => ({
      sessionId: `s${i}`, ctxTokens: 1, outputTokens: i, samples: 1, lastTs: i, model: null, requestedModel: null, costUsd: i,
    })) as never;
    const { container, getByText, queryByText } = render(<UsageTable rows={many} known={new Set()} titleOf={(id) => id} onOpenSession={() => {}} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(USAGE_PAGE);
    fireEvent.click(getByText('ver mais (7 restantes)'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(USAGE_PAGE + 7);
    expect(queryByText(/ver mais/)).toBeNull();
  });
});
