// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ModeToggle } from './ModeToggle';

afterEach(cleanup);

describe('ModeToggle', () => {
  it('exposes the active mode with aria-pressed, not only colour', () => {
    const { getAllByRole } = render(<ModeToggle mode="auto" setMode={() => {}} />);
    const pressed = getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
  });
});
