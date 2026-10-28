// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeAudio {
  static instances: FakeAudio[] = [];
  src = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  play = vi.fn(async () => {});
  constructor() { FakeAudio.instances.push(this); }
  finish() { this.onended?.(); }
}

const synthSpeak = vi.fn();
const synthCancel = vi.fn();
const fetchMock = vi.fn();

const two = 'Primeira frase bem longa para dividir o texto em pedaços de áudio distintos, com bastante conteúdo. Segunda frase também longa para forçar outro pedaço de áudio separado agora, com mais conteúdo ainda.';

async function load() {
  vi.resetModules();
  return (await import('./useCallSpeech')).useCallSpeech;
}

const flush = () => act(async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); });
const ok = () => ({ ok: true, blob: async () => ({ size: 3 }) });

beforeEach(() => {
  FakeAudio.instances = [];
  synthSpeak.mockClear(); synthCancel.mockClear(); fetchMock.mockReset();
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(t: string) { this.text = t; } });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: synthSpeak, cancel: synthCancel } });
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe('useCallSpeech', () => {
  it('plays chunks in order on one audio element, prefetching the next, then fires onDone once', async () => {
    fetchMock.mockImplementation(async () => ok());
    const useCallSpeech = await load();
    const onDone = vi.fn();
    const { result } = renderHook(() => useCallSpeech(onDone));
    act(() => result.current.speak(two));
    await flush();
    expect(fetchMock.mock.calls.length).toBe(2);
    expect(FakeAudio.instances).toHaveLength(1);
    const el = FakeAudio.instances[0];
    expect(el.play).toHaveBeenCalledTimes(1);
    act(() => el.finish());
    await flush();
    expect(onDone).not.toHaveBeenCalled();
    expect(el.play).toHaveBeenCalledTimes(2);
    act(() => el.finish());
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(synthSpeak).not.toHaveBeenCalled();
  });

  it('sends the bearer token when one is saved', async () => {
    localStorage.setItem('cockpit:auth.token', JSON.stringify('tok'));
    fetchMock.mockImplementation(async () => ok());
    const useCallSpeech = await load();
    const { result } = renderHook(() => useCallSpeech(vi.fn()));
    act(() => result.current.speak('Olá, tudo bem?'));
    await flush();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    localStorage.clear();
  });

  it('cancel stops playback, aborts fetches and never fires onDone', async () => {
    fetchMock.mockImplementation(async () => ok());
    const useCallSpeech = await load();
    const onDone = vi.fn();
    const { result } = renderHook(() => useCallSpeech(onDone));
    act(() => result.current.speak(two));
    await flush();
    const signal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal;
    const el = FakeAudio.instances[0];
    act(() => result.current.cancel());
    expect(signal.aborted).toBe(true);
    expect(el.pause).toHaveBeenCalled();
    expect(result.current.spokenRef.current).toBe('');
    act(() => el.finish());
    await flush();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('a new speak after cancel is not confused by the old run', async () => {
    fetchMock.mockImplementation(async () => ok());
    const useCallSpeech = await load();
    const onDone = vi.fn();
    const { result } = renderHook(() => useCallSpeech(onDone));
    act(() => result.current.speak(two));
    await flush();
    act(() => result.current.speak('Só uma frase.'));
    await flush();
    act(() => FakeAudio.instances[0].finish());
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('falls back to the browser voice when the server fails', async () => {
    fetchMock.mockImplementation(async () => new Response('no', { status: 401 }));
    const useCallSpeech = await load();
    const onDone = vi.fn();
    const { result } = renderHook(() => useCallSpeech(onDone));
    act(() => result.current.speak('Olá, tudo bem?'));
    await flush();
    expect(synthSpeak).toHaveBeenCalledTimes(1);
    const u = synthSpeak.mock.calls[0][0] as { text: string; onend: () => void };
    expect(u.text).toBe('Olá, tudo bem?');
    act(() => u.onend());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('prime plays a silent clip on the reused element', async () => {
    const useCallSpeech = await load();
    const { result } = renderHook(() => useCallSpeech(vi.fn()));
    act(() => result.current.prime());
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toContain('data:audio/wav');
    expect(FakeAudio.instances[0].play).toHaveBeenCalled();
  });
});
