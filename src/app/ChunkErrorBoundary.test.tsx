// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ChunkErrorBoundary, reloadOnStaleChunk } from './ChunkErrorBoundary';

afterEach(cleanup);

function Boom(): never { throw new Error('Failed to fetch dynamically imported module'); }

describe('ChunkErrorBoundary', () => {
  it('shows a reload card instead of unmounting everything', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getByRole, getByText } = render(<ChunkErrorBoundary><Boom /></ChunkErrorBoundary>);
    expect(getByRole('alert')).toBeTruthy();
    expect(getByText('Recarregar')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('reloadOnStaleChunk', () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

  it('reloads once, then leaves a repeat within a minute to the boundary', () => {
    const s = store();
    const reload = vi.fn();
    expect(reloadOnStaleChunk(1_000_000, s, reload)).toBe(true);
    expect(reloadOnStaleChunk(1_030_000, s, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnStaleChunk(1_070_000, s, reload)).toBe(true);
  });
});
