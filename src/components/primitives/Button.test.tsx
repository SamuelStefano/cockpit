// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it.each(['xs', 'sm', 'md'] as const)('keeps dense %s size on coarse pointers', (size) => {
    render(<Button size={size}>go</Button>);
    expect(screen.getByRole('button').className).not.toContain('pointer-coarse:min-h');
  });

  it('keeps square buttons compact on coarse pointers', () => {
    render(<Button square size="sm" aria-label="x" />);
    expect(screen.getByRole('button').className).not.toContain('pointer-coarse:min-w');
  });
});
