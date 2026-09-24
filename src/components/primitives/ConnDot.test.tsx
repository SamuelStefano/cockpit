// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ConnDot } from './ConnDot';

afterEach(cleanup);

describe('ConnDot', () => {
  it('names its state once, without a native title doubling the hover bubble', () => {
    const { getByRole } = render(<ConnDot label="ws" state="down" />);
    const dot = getByRole('status', { name: 'ws · caiu' });
    expect(dot.hasAttribute('title')).toBe(false);
  });
});
