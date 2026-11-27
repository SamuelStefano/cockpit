// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const session = { stop: vi.fn(), reset: vi.fn() };
let handlers: { onHeard: (h: { text: string; isFinal: boolean; confidence: number }) => void; onUnavailable: () => void } | null = null;
vi.mock('./call/scribe-capture', () => ({
  scribeSupported: () => true,
  primeScribeAudio: vi.fn(),
  startScribe: (h: typeof handlers) => { handlers = h; return session; },
}));

import { useSpeechInput } from './useSpeechInput';

describe('useSpeechInput with Scribe', () => {
  it('writes Scribe transcripts after the existing text and stops the session', () => {
    const setValue = vi.fn();
    const { result } = renderHook(() => useSpeechInput('oi', setValue));
    expect(result.current.supported).toBe(true);
    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => handlers!.onHeard({ text: 'tudo bem', isFinal: false, confidence: 0 }));
    expect(setValue).toHaveBeenLastCalledWith(expect.stringContaining('tudo bem'));
    act(() => result.current.stop());
    expect(session.stop).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });
});
