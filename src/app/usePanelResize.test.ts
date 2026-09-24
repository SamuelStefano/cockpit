// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePanelResize, LEFT_RANGE } from './usePanelResize';

beforeEach(() => localStorage.clear());

const key = (k: string, shiftKey = false) => ({ key: k, shiftKey, preventDefault: () => {} }) as unknown as React.KeyboardEvent;

describe('usePanelResize keyboard', () => {
  it('moves the divider with the arrows and clamps to the range', () => {
    const { result } = renderHook(() => usePanelResize());
    const start = result.current.leftW;
    act(() => result.current.nudge('left', key('ArrowRight')));
    expect(result.current.leftW).toBe(start + 1);
    act(() => { for (let i = 0; i < 10; i++) result.current.nudge('left', key('ArrowRight', true)); });
    expect(result.current.leftW).toBe(LEFT_RANGE[1]);
  });

  it('grows the right panel when its divider moves left', () => {
    const { result } = renderHook(() => usePanelResize());
    const start = result.current.rightW;
    act(() => result.current.nudge('right', key('ArrowLeft')));
    expect(result.current.rightW).toBe(start + 1);
  });
});
