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
  say(text: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });
  }
}

const speak = vi.fn();
const cancel = vi.fn();

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
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(t: string) { this.text = t; } });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak, cancel, speaking: false } });
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
    expect(speak).not.toHaveBeenCalledWith(expect.objectContaining({ text: 'Pronto, terminei.' }));
    rerender({ phase: 'idle', messages: [user, answer] });
    expect(result.current.state.phase).toBe('speaking');
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Pronto, terminei.' }));
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
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Pronto, terminei.' }));
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
});
