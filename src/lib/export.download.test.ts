// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { download } from './export';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('download', () => {
  it('revokes the blob URL only after the click had time to start the download', () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    download('a.md', 'text/markdown', 'hi');
    expect(click).toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
