// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechInput } from './useSpeechInput';

// Reconhecimento falso controlável: o teste dispara onresult/onend/onerror à mão
// pra simular o ciclo do engine (Android encerra a cada pausa; permissão negada).
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  started = false;
  stopped = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  fireFinal(text: string) {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: text }, isFinal: true }] });
  }
}

const last = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];

beforeEach(() => {
  FakeRecognition.instances = [];
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
});

describe('useSpeechInput', () => {
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
    expect(FakeRecognition.instances.length).toBe(1);
  });

  it('desiste após falhas seguidas na largada (sem captar nada)', () => {
    const { result } = renderHook(() => useSpeechInput('', vi.fn()));
    act(() => result.current.start());
    // três encerramentos imediatos sem resultado → desiste.
    act(() => { last().onend?.(); });
    act(() => { last().onend?.(); });
    act(() => { last().onend?.(); });
    expect(result.current.listening).toBe(false);
    expect(result.current.error).not.toBeNull();
  });
});
