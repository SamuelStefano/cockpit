// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechInput, NO_CAPTURE_MS, NO_CAPTURE_AFTER_AUDIO_MS } from './useSpeechInput';
import { forgetEngineFailure, hasRecentEngineFailure, rememberEngineFailure } from './speech-fallback';

// Reconhecimento falso controlável: o teste dispara onresult/onend/onerror à mão
// pra simular o ciclo do engine (Android encerra a cada pausa; permissão negada).
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static throwOnStart = false;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onaudiostart: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { if (FakeRecognition.throwOnStart) throw new Error('already started'); this.started = true; }
  stop() { this.stopped = true; }
  fireFinal(text: string) {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: text }, isFinal: true }] });
  }
}

const last = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];

function setTouch(touch: boolean) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch ? 5 : 0, configurable: true });
  window.matchMedia = ((query: string) => ({ matches: touch && query === '(pointer: coarse)' })) as typeof window.matchMedia;
}

function setIosStandalone(on: boolean) {
  Object.defineProperty(navigator, 'userAgent', { value: on ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : 'jsdom', configurable: true });
  Object.defineProperty(navigator, 'standalone', { value: on ? true : undefined, configurable: true });
}

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.throwOnStart = false;
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  setTouch(false);
  setIosStandalone(false);
  forgetEngineFailure();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
});

describe('useSpeechInput (desktop)', () => {
  it('reinicia o reconhecimento quando o engine encerra por pausa (Android)', () => {
    const setValue = vi.fn();
    const { result } = renderHook(() => useSpeechInput('', setValue));

    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    expect(FakeRecognition.instances.length).toBe(1);

    // engine captou fala e encerrou (pausa) — deve reabrir um novo, sem desligar.
    act(() => { last().fireFinal('olá'); last().onend?.(); });
    expect(FakeRecognition.instances.length).toBe(2);
    expect(result.current.listening).toBe(true);
  });

  it('para de vez quando o usuário pede stop (não reinicia)', () => {
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    act(() => result.current.start());
    act(() => { result.current.stop(); last().onend?.(); });
    expect(result.current.listening).toBe(false);
    expect(FakeRecognition.instances.length).toBe(1);
  });

  it('erro de permissão é fatal: desliga e expõe mensagem, sem reiniciar', () => {
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    act(() => result.current.start());
    act(() => { last().onerror?.({ error: 'not-allowed' }); last().onend?.(); });
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toMatch(/microfone/i);
    expect(result.current.hint).toBeNull();
    expect(FakeRecognition.instances.length).toBe(1);
  });

  it('desiste após falhas seguidas na largada (sem captar nada)', () => {
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    act(() => result.current.start());
    act(() => { last().onend?.(); });
    act(() => { last().onend?.(); });
    act(() => { last().onend?.(); });
    expect(result.current.listening).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it('engine ligado que nunca capta mostra erro e não lembra falha (desktop)', () => {
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(NO_CAPTURE_MS); });
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toMatch(/áudio/i);
    expect(result.current.hint).toBeNull();
    expect(hasRecentEngineFailure()).toBe(false);
  });

  it('mic aberto (onaudiostart) ganha mais tempo antes do watchdog desistir', () => {
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(NO_CAPTURE_MS - 1000); last().onaudiostart?.(); });
    act(() => { vi.advanceTimersByTime(NO_CAPTURE_MS); });
    expect(result.current.listening).toBe(true);
    act(() => { vi.advanceTimersByTime(NO_CAPTURE_AFTER_AUDIO_MS); });
    expect(result.current.listening).toBe(false);
  });

  it('stop() sem onend do engine solta o mic e destrava listening', () => {
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    act(() => result.current.start());
    const rec = last();
    act(() => result.current.stop());
    expect(result.current.listening).toBe(true);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.listening).toBe(false);
    expect(rec.onresult).toBeNull();
  });

  it('start() que lança não deixa listening preso', () => {
    FakeRecognition.throwOnStart = true;
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    act(() => result.current.start());
    expect(result.current.listening).toBe(false);
    expect(result.current.error).not.toBeNull();
  });
});

describe('useSpeechInput (touch)', () => {
  beforeEach(() => setTouch(true));

  it('engine presente mas sem captar cai pro modo teclado (foca + dica, sem erro)', () => {
    const focus = vi.fn();
    const { result } = renderHook(() => useSpeechInput('', vi.fn(), focus));
    expect(result.current.keyboardMode).toBe(false);
    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => { vi.advanceTimersByTime(NO_CAPTURE_MS); });
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hint).toMatch(/teclado/i);
    expect(result.current.keyboardMode).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(hasRecentEngineFailure()).toBe(true);

    // próximo toque no mic vai direto pro teclado, sem tentar o engine de novo.
    act(() => result.current.start());
    expect(FakeRecognition.instances.length).toBe(1);
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it('erro fatal (not-allowed) cai pro modo teclado', () => {
    const focus = vi.fn();
    const { result } = renderHook(() => useSpeechInput('', vi.fn(), focus));
    act(() => result.current.start());
    act(() => { last().onerror?.({ error: 'service-not-allowed' }); last().onend?.(); });
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hint).toMatch(/teclado/i);
    expect(result.current.keyboardMode).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('falhas seguidas na largada caem pro modo teclado', () => {
    const focus = vi.fn();
    const { result } = renderHook(() => useSpeechInput('', vi.fn(), focus));
    act(() => result.current.start());
    act(() => { last().onend?.(); });
    act(() => { last().onend?.(); });
    act(() => { last().onend?.(); });
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.keyboardMode).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('iPhone pela tela inicial nem tenta o engine', () => {
    setIosStandalone(true);
    const focus = vi.fn();
    const { result } = renderHook(() => useSpeechInput('', vi.fn(), focus));
    expect(result.current.supported).toBe(true);
    expect(result.current.keyboardMode).toBe(true);
    act(() => result.current.start());
    expect(FakeRecognition.instances.length).toBe(0);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(result.current.hint).toMatch(/teclado/i);
  });

  it('falha lembrada de outra abertura já começa em modo teclado', () => {
    rememberEngineFailure();
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    expect(result.current.keyboardMode).toBe(true);
  });

  it('sem Web Speech API o mic continua suportado, via teclado', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    const focus = vi.fn();
    const { result } = renderHook(() => useSpeechInput('', vi.fn(), focus));
    expect(result.current.supported).toBe(true);
    act(() => result.current.start());
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('a dica do teclado some quando o texto muda', () => {
    setIosStandalone(true);
    const { result, rerender } = renderHook(({ v }: { v: string }) => useSpeechInput(v, vi.fn()), { initialProps: { v: '' } });
    act(() => result.current.start());
    expect(result.current.hint).not.toBeNull();
    rerender({ v: 'oi' });
    expect(result.current.hint).toBeNull();
  });
});
