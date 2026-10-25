// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const opened: HTMLElement[] = [];
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon() {}
    open(el: HTMLElement) { opened.push(el); }
    onData() { return { dispose() {} }; }
    attachCustomKeyEventHandler() {}
    hasSelection() { return false; }
    focus() {}
    write() {}
    reset() {}
    dispose() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });

import { XtermView } from './Xterm';
import type { TermApi } from '../useCockpit';

afterEach(() => { cleanup(); opened.length = 0; });

const term = { attach: vi.fn(), detach: vi.fn(), input: vi.fn(), resize: vi.fn() } as unknown as TermApi;

describe('XtermView host element', () => {
  it('opens xterm in an unpadded element so FitAddon does not count the padding as rows/cols', () => {
    render(<XtermView id="t1" term={term} autoFocus={false} />);
    expect(opened).toHaveLength(1);
    expect(opened[0].style.padding).toBe('');
    expect(opened[0].parentElement?.style.padding).toBe('6px 4px 4px 8px');
  });

  it('resets the inherited letter-spacing that made glyphs overflow their cells', () => {
    render(<XtermView id="t1" term={term} autoFocus={false} />);
    expect(opened[0].parentElement?.style.letterSpacing).toBe('normal');
  });

  it('taps live data and replays through onOutput without reattaching on a new callback', () => {
    const attach = vi.fn();
    const t = { ...term, attach } as unknown as TermApi;
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<XtermView id="t2" term={t} autoFocus={false} onOutput={first} />);
    rerender(<XtermView id="t2" term={t} autoFocus={false} onOutput={second} />);
    expect(attach).toHaveBeenCalledTimes(1);
    const [, , , onData, , onReplay] = attach.mock.calls[0];
    onData('hi');
    onReplay('snap');
    expect(first).not.toHaveBeenCalled();
    expect(second.mock.calls).toEqual([['hi', false], ['snap', true]]);
  });
});
