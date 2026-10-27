// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Tooltip', () => {
  it('shows the label after the delay and links it with aria-describedby', () => {
    render(<Tooltip label="Dica" delay={200}><button>x</button></Tooltip>);
    const btn = screen.getByRole('button');
    fireEvent.pointerEnter(btn.parentElement!, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('Dica');
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('hides on pointer leave and never opens for touch', () => {
    render(<Tooltip label="Dica" delay={0}><button>x</button></Tooltip>);
    const wrap = screen.getByRole('button').parentElement!;
    fireEvent.pointerEnter(wrap, { pointerType: 'touch' });
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerEnter(wrap, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerLeave(wrap);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<Tooltip label="Dica" delay={0}><button>x</button></Tooltip>);
    fireEvent.pointerEnter(screen.getByRole('button').parentElement!, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(10); });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
