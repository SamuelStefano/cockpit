// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AuthGate } from './AuthGate';

afterEach(cleanup);

// On the #0d0d0f card, neutral-500 (#5b5b64) is 2.9:1 and neutral-600 (#3d3d44)
// 1.8:1 — WCAG AA asks 4.5:1 for 11px text. neutral-400 is 5.1:1 (axe-checked).
describe('AuthGate contrast', () => {
  it('its own help text and link use neutral-400 or lighter', () => {
    const { getByText } = render(<AuthGate onSubmit={() => {}} />);
    for (const el of [getByText(/Este Deck controla a VPS/), getByText('COCKPIT_TOKEN'), getByText(/Configurar endereço do backend/)]) {
      expect(el.className).not.toMatch(/text-neutral-(500|600|700)/);
    }
  });
});
