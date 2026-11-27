// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../../data/types';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = ''; continuous = false; interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor() { FakeRecognition.instances.push(this); }
  start() {}
  stop() {}
  abort() {}
  results: unknown[] = [];
  say(text: string, isFinal = true, confidence = 0) {
    const prev = this.results.at(-1) as { isFinal: boolean } | undefined;
    const next = Object.assign([{ transcript: text, confidence }], { isFinal });
    if (prev && !prev.isFinal) this.results[this.results.length - 1] = next; else this.results.push(next);
    this.onresult?.({ resultIndex: 0, results: this.results });
  }
}

const speak = vi.fn();
const cancel = vi.fn();
const spokenRef = { current: '' };

vi.mock('./useCallSpeech', () => ({
  callSpeechSupported: true,
  useCallSpeech: () => ({ speak, cancel, prime: vi.fn(), spokenRef }),
}));

async function load() {
  vi.resetModules();
  return (await import('./useCall')).useCall;
}

const user: Message = { id: 'u1', role: 'user', text: 'oi' };
const answer: Message = { id: 'a1', role: 'assistant', blocks: [{ type: 'text', md: 'Pronto, terminei.' }] };

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.instances = [];
  speak.mockClear(); cancel.mockClear();
  spokenRef.current = '';
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useCall', () => {
  it('sends the utterance after silence, then speaks the final reply', async () => {
    const useCall = await load();
    const onSend = vi.fn();
    const { result, rerender } = renderHook((p: { phase: 'idle' | 'thinking'; messages: Message[] }) => useCall({ ...p, onSend }), {
      initialProps: { phase: 'idle', messages: [] },
    });
    expect(result.current.supported).toBe(true);

    act(() => result.current.dial());
    expect(result.current.state.phase).toBe('listening');
    const rec = FakeRecognition.instances.at(-1)!;

    act(() => rec.say('roda os testes por favor.'));
    expect(onSend).not.toHaveBeenCalled();
    expect(result.current.heard).toBe('roda os testes por favor.');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onSend).toHaveBeenCalledWith('roda os testes por favor.');
    expect(result.current.state.phase).toBe('thinking');

    rerender({ phase: 'thinking', messages: [user] });
    expect(speak).not.toHaveBeenCalledWith('Pronto, terminei.');
    rerender({ phase: 'idle', messages: [user, answer] });
    expect(result.current.state.phase).toBe('speaking');
    expect(speak).toHaveBeenCalledWith('Pronto, terminei.');
  });

  it('a new chat migrating to its real id keeps the call and speaks the reply', async () => {
    const useCall = await load();
    const onSend = vi.fn();
    type P = { phase: 'idle' | 'thinking'; messages: Message[]; sessionKey: string; pendingIds: Record<string, string> };
    const { result, rerender } = renderHook((p: P) => useCall({ ...p, onSend }), {
      initialProps: { phase: 'idle', messages: [], sessionKey: 'new-abc', pendingIds: {} },
    });
    act(() => result.current.dial());
    act(() => FakeRecognition.instances.at(-1)!.say('oi tudo bem.'));
    act(() => { vi.advanceTimersByTime(1000); });
    rerender({ phase: 'thinking', messages: [user], sessionKey: 'new-abc', pendingIds: { 'new-abc': 'uuid-1' } });
    rerender({ phase: 'idle', messages: [user, answer], sessionKey: 'uuid-1', pendingIds: {} });
    expect(result.current.state.phase).toBe('speaking');
    expect(speak).toHaveBeenCalledWith('Pronto, terminei.');
  });

  it('opening another session hangs up', async () => {
    const useCall = await load();
    const { result, rerender } = renderHook((p: { sessionKey: string }) => useCall({ phase: 'idle', messages: [], onSend: vi.fn(), ...p }), {
      initialProps: { sessionKey: 'uuid-1' },
    });
    act(() => result.current.dial());
    rerender({ sessionKey: 'uuid-2' });
    expect(result.current.state.phase).toBe('off');
  });

  it('keeps waiting while the speaker is mid-sentence', async () => {
    const useCall = await load();
    const onSend = vi.fn();
    const { result } = renderHook(() => useCall({ phase: 'idle', messages: [], onSend }));
    act(() => result.current.dial());
    const rec = FakeRecognition.instances.at(-1)!;
    act(() => rec.say('eu queria que'));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onSend).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(600); });
    expect(onSend).toHaveBeenCalledWith('eu queria que');
  });

  it('hang up cancels speech and returns to off', async () => {
    const useCall = await load();
    const { result } = renderHook(() => useCall({ phase: 'idle', messages: [], onSend: vi.fn() }));
    act(() => result.current.dial());
    cancel.mockClear();
    act(() => result.current.hangup());
    expect(result.current.state.phase).toBe('off');
    expect(cancel).toHaveBeenCalled();
  });

  it('muting stops the recognizer from sending', async () => {
    const useCall = await load();
    const { result } = renderHook(() => useCall({ phase: 'idle', messages: [], onSend: vi.fn() }));
    act(() => result.current.dial());
    const before = FakeRecognition.instances.length;
    act(() => result.current.toggleMute());
    expect(result.current.state.muted).toBe(true);
    act(() => result.current.toggleMute());
    expect(FakeRecognition.instances.length).toBeGreaterThan(before);
  });

  describe('barge-in while speaking', () => {
    async function speaking() {
      const useCall = await load();
      const hook = renderHook((p: { phase: 'idle' | 'thinking'; messages: Message[] }) => useCall({ ...p, onSend: vi.fn() }), {
        initialProps: { phase: 'idle', messages: [] },
      });
      act(() => hook.result.current.dial());
      const rec = FakeRecognition.instances.at(-1)!;
      act(() => rec.say('roda os testes por favor.'));
      act(() => { vi.advanceTimersByTime(1000); });
      hook.rerender({ phase: 'thinking', messages: [user] });
      hook.rerender({ phase: 'idle', messages: [user, answer] });
      spokenRef.current = 'Pronto, terminei. Quer que eu abra o PR agora?';
      cancel.mockClear();
      return { ...hook, rec };
    }

    it('ignores noise words and echo', async () => {
      const { result, rec } = await speaking();
      act(() => rec.say('é', true));
      act(() => rec.say('ah ah', true));
      act(() => rec.say('abra o PR agora', true));
      expect(result.current.state.phase).toBe('speaking');
      expect(cancel).not.toHaveBeenCalled();
    });

    it('interrupts on a final result with three or more real words', async () => {
      const { result, rec } = await speaking();
      act(() => rec.say('para um segundo', true));
      expect(result.current.state.phase).toBe('listening');
      expect(cancel).toHaveBeenCalled();
    });

    it('does not interrupt on a single interim result but does once it persists', async () => {
      const { result, rec } = await speaking();
      act(() => rec.say('para um segundo', false));
      expect(result.current.state.phase).toBe('speaking');
      act(() => rec.say('para um segundo agora', false));
      expect(result.current.state.phase).toBe('listening');
    });

    it('ignores low-confidence results', async () => {
      const { result, rec } = await speaking();
      act(() => rec.say('para um segundo', true, 0.2));
      expect(result.current.state.phase).toBe('speaking');
    });

    it('the manual interrupt still works', async () => {
      const { result } = await speaking();
      act(() => result.current.interrupt());
      expect(result.current.state.phase).toBe('listening');
    });
  });
});
