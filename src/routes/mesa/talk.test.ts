// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTalkOnce } from './talk';

describe('useTalkOnce', () => {
  it('waits for the lead and talks only once', () => {
    const onTalk = vi.fn();
    const hook = renderHook(({ id }: { id: string }) => useTalkOnce(id, onTalk), { initialProps: { id: '' } });
    expect(onTalk).not.toHaveBeenCalled();
    hook.rerender({ id: 'lead' });
    hook.rerender({ id: 'lead' });
    expect(onTalk).toHaveBeenCalledOnce();
  });
});
