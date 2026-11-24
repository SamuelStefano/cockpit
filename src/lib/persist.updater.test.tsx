// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { usePersisted } from './persist';

beforeEach(() => localStorage.clear());

let bump: (() => void) | null = null;
function Writer() {
  const [n, set] = usePersisted<number>('count', 0);
  bump = () => { set((p) => p + 1); set((p) => p + 1); };
  return <span data-testid="w">{n}</span>;
}
function Reader() {
  const [n] = usePersisted<number>('count', 0);
  return <span data-testid="r">{n}</span>;
}

describe('usePersisted functional updates', () => {
  it('chain, persist once per call and sync other instances without a render-phase warning', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getByTestId } = render(<StrictMode><Writer /><Reader /></StrictMode>);
    act(() => bump!());
    expect(getByTestId('w').textContent).toBe('2');
    expect(getByTestId('r').textContent).toBe('2');
    expect(localStorage.getItem('cockpit:count')).toBe('2');
    expect(err.mock.calls.filter((c) => String(c[0]).includes('Cannot update a component'))).toEqual([]);
    err.mockRestore();
  });
});
