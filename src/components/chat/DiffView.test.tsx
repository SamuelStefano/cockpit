// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DiffView } from './DiffView';

afterEach(cleanup);

const lines = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag} ${i}`).join('\n');

describe('DiffView', () => {
  it('opens small diffs', () => {
    const { container } = render(<DiffView diff={{ old: 'a', new: 'b' } as never} />);
    expect(container.querySelector('pre')).not.toBeNull();
  });

  it('starts large diffs collapsed, counts still visible', () => {
    const { container, getByText } = render(<DiffView diff={{ old: lines(100, 'old'), new: lines(100, 'new') } as never} />);
    expect(container.querySelector('pre')).toBeNull();
    expect(getByText('+100')).toBeTruthy();
  });
});
