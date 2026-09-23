// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { GhostSummaryBanner } from './GhostSummaryBanner';

afterEach(cleanup);

const props = (over: Partial<Parameters<typeof GhostSummaryBanner>[0]> = {}) => ({
  summary: 'fez X e parou em Y', lastActiveAt: Date.now() - 90 * 60_000, collapsed: false,
  onToggleCollapsed: vi.fn(), onDismiss: vi.fn(), onContinue: vi.fn(), continueEnabled: true, ...over,
});

describe('GhostSummaryBanner', () => {
  it('shows the summary (in the strip AND the expanded overlay) and time since last activity when expanded', () => {
    render(<GhostSummaryBanner {...props()} />);
    expect(screen.getAllByText('fez X e parou em Y').length).toBeGreaterThan(0);
    expect(screen.getByText(/parada há/)).toBeTruthy();
  });

  it('collapsed reserves the fixed one-line strip and hides the time/continue overlay', () => {
    render(<GhostSummaryBanner {...props({ collapsed: true })} />);
    expect(screen.getByText('fez X e parou em Y')).toBeTruthy(); // only the strip's copy
    expect(screen.queryByText(/parada há/)).toBeNull();
    expect(screen.queryByText('continuar daqui')).toBeNull();
  });

  it('the collapse toggle calls onToggleCollapsed', () => {
    const onToggleCollapsed = vi.fn();
    render(<GhostSummaryBanner {...props({ onToggleCollapsed })} />);
    fireEvent.click(screen.getByTitle('recolher resumo'));
    expect(onToggleCollapsed).toHaveBeenCalled();
  });

  it('dismiss calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(<GhostSummaryBanner {...props({ onDismiss })} />);
    fireEvent.click(screen.getByTitle('dispensar'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('"continuar daqui" calls onContinue when enabled', () => {
    const onContinue = vi.fn();
    render(<GhostSummaryBanner {...props({ onContinue })} />);
    fireEvent.click(screen.getByText('continuar daqui'));
    expect(onContinue).toHaveBeenCalled();
  });

  it('"continuar daqui" is disabled while the prompt bar itself is disabled (pane resumed interactively)', () => {
    const onContinue = vi.fn();
    render(<GhostSummaryBanner {...props({ onContinue, continueEnabled: false })} />);
    const btn = screen.getByText('continuar daqui').closest('button')!;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('the reserved strip height is identical collapsed or expanded (toggling must never resize the terminal/pty beneath it)', () => {
    const { container: collapsedC } = render(<GhostSummaryBanner {...props({ collapsed: true })} />);
    const { container: expandedC } = render(<GhostSummaryBanner {...props({ collapsed: false })} />);
    const heightOf = (c: HTMLElement) => (c.firstElementChild as HTMLElement).style.height;
    expect(heightOf(collapsedC)).toBe(heightOf(expandedC));
    // The expanded extra content is a sibling INSIDE that same fixed-height
    // node, absolutely positioned — not a taller reserved box.
    expect(expandedC.querySelector('.absolute.top-full')).toBeTruthy();
  });

  it('does not leak a pointerdown to the window drag handler beneath it', () => {
    const onOuter = vi.fn();
    const { container } = render(<div onPointerDown={onOuter}><GhostSummaryBanner {...props()} /></div>);
    fireEvent.pointerDown(container.firstElementChild!.firstElementChild!);
    expect(onOuter).not.toHaveBeenCalled();
  });
});
