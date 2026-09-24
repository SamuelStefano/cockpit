// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SessionsEmptyState } from './SessionsEmptyState';

afterEach(cleanup);

describe('SessionsEmptyState', () => {
  it('offers a way out of an empty search', () => {
    const onClear = vi.fn();
    const { getByText } = render(<SessionsEmptyState hasSessions query="xyz" tagFilter="dfl" onNew={vi.fn()} onClear={onClear} />);
    expect(getByText('#dfl')).toBeTruthy();
    fireEvent.click(getByText('limpar busca'));
    expect(onClear).toHaveBeenCalled();
  });

  it('offers to clear a tag filter that matches nothing', () => {
    const onClear = vi.fn();
    const { getByText } = render(<SessionsEmptyState hasSessions query="" tagFilter="dfl" onNew={vi.fn()} onClear={onClear} />);
    fireEvent.click(getByText('limpar filtro'));
    expect(onClear).toHaveBeenCalled();
  });
});
