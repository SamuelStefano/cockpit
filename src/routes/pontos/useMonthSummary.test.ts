// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const ctl = vi.hoisted(() => ({ setMonthCapCents: vi.fn(), toast: vi.fn() }));
vi.mock('./pontosControls', () => ({
  usePontosControls: () => ({ pointValue: 75, setPointValue: vi.fn(), monthCapCents: () => 400000, setMonthCapCents: ctl.setMonthCapCents }),
}));
vi.mock('../../components/primitives', () => ({ toast: ctl.toast }));

import { useMonthSummary } from './useMonthSummary';

describe('useMonthSummary.saveMonthCap', () => {
  it('saves the cap for the current month and confirms it, saying it is per browser', () => {
    const now = new Date(2026, 8, 24).getTime();
    const { result } = renderHook(() => useMonthSummary({ snapshot: null, totals: undefined, now }));
    result.current.saveMonthCap('4.500,00');
    expect(ctl.setMonthCapCents).toHaveBeenCalledWith('2026-09', 450000);
    expect(ctl.toast).toHaveBeenCalledWith(expect.stringContaining('só neste navegador'));
  });
});
