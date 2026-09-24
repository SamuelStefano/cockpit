// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DocViewer } from './DocViewer';

afterEach(cleanup);

// jsdom has no IntersectionObserver (the scroll-spy uses it).
globalThis.IntersectionObserver ??= class {
  observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;
// Nor CSS.escape; the slugs here need no escaping.
globalThis.CSS ??= { escape: (s: string) => s } as unknown as typeof CSS;

describe('DocViewer outline with repeated headings', () => {
  it('each outline entry scrolls to its own heading', () => {
    const body = '# A\n\n## X\n\nx\n\n## X\n\ny\n\n## Z';
    const { container, getAllByTitle } = render(<DocViewer title="doc" body={body} onClose={() => {}} />);
    const ids = [...container.querySelectorAll('h2')].map((h) => h.id);
    expect(ids).toEqual(['x', 'x-2', 'z']);
    const second = container.querySelector<HTMLElement>('#x-2')!;
    const scroll = vi.fn();
    second.scrollIntoView = scroll;
    fireEvent.click(getAllByTitle('X')[1]);
    expect(scroll).toHaveBeenCalled();
  });
});
