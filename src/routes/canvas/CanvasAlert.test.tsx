// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AlertBadge, AlertRing } from './CanvasAlert';

afterEach(cleanup);

describe('AlertRing', () => {
  it('renders nothing for no alert', () => {
    const { container } = render(<AlertRing kind={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a yellow ring for waiting, as a STATIC inline box-shadow (never the shared, orange-only .pulse-ring)', () => {
    const { container } = render(<AlertRing kind="waiting" />);
    const el = container.querySelector('.alert-ring') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).not.toContain('pulse-ring');
    expect(el.style.boxShadow).toContain('250, 204, 21'); // yellow-400
  });

  it('renders a red ring for a hot context', () => {
    const { container } = render(<AlertRing kind="context" />);
    const el = container.querySelector('.alert-ring') as HTMLElement;
    expect(el.style.boxShadow).toContain('239, 68, 68'); // red-500
  });

  it('the ring is INSET (never clipped by a parent overflow-hidden)', () => {
    const { container } = render(<AlertRing kind="waiting" />);
    const el = container.querySelector('.alert-ring') as HTMLElement;
    expect(el.style.boxShadow).toContain('inset');
  });
});

describe('AlertBadge', () => {
  it('renders nothing for no alert', () => {
    const { container } = render(<AlertBadge kind={null} pct={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('labels waiting', () => {
    const { getByText } = render(<AlertBadge kind="waiting" pct={null} />);
    expect(getByText('esperando você')).toBeTruthy();
  });

  it('labels a hot context with its percentage', () => {
    const { getByText } = render(<AlertBadge kind="context" pct={83} />);
    expect(getByText('contexto 83%')).toBeTruthy();
  });
});
