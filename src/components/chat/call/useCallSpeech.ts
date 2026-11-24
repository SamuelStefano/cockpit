import { useCallback, useEffect, useMemo, useRef } from 'react';
import { requestTts } from '../../../cockpit/tts-bus';
import { SPEECH_LANG } from '../speech';
import { splitForSpeech } from './utterance';

const hasSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window;
const hasAudio = typeof window !== 'undefined' && typeof Audio !== 'undefined';
export const callSpeechSupported = hasSynthesis || hasAudio;

const TTS_COOLDOWN_MS = 30000;
// WAV header with no samples: enough to satisfy the autoplay unlock.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

// Plays the box's neural voice (a `tts` frame on the chat socket) chunk by chunk (the next chunk is fetched while
// the current one plays) and falls back to the browser voice when the server can't
// answer, so a call never goes silent. Every cancel() bumps `run` so late callbacks
// from an interrupted reply never fire onDone for the next one.
export function useCallSpeech(onDone: () => void) {
  const runRef = useRef(0);
  const spokenRef = useRef('');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const settleRef = useRef<((ok: boolean) => void) | null>(null);
  const failedAtRef = useRef(0);

  const audio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }, []);

  const cancel = useCallback(() => {
    runRef.current += 1;
    spokenRef.current = '';
    abortRef.current?.abort();
    abortRef.current = null;
    const el = audioRef.current;
    if (el) { el.onended = null; el.onerror = null; try { el.pause(); } catch { /* not playing */ } }
    settleRef.current?.(false);
    if (hasSynthesis) window.speechSynthesis.cancel();
  }, []);

  const playBlob = useCallback((blob: Blob) => new Promise<boolean>((resolve) => {
    const el = audio();
    const url = URL.createObjectURL(blob);
    const settle = (ok: boolean) => {
      if (settleRef.current !== settle) return;
      settleRef.current = null;
      el.onended = null;
      el.onerror = null;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    settleRef.current = settle;
    el.onended = () => settle(true);
    el.onerror = () => settle(false);
    el.src = url;
    el.play().catch(() => settle(false));
  }), [audio]);

  const speakWithBrowser = useCallback((chunks: string[], run: number) => {
    if (!hasSynthesis) { if (runRef.current === run) doneRef.current(); return; }
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = SPEECH_LANG;
      const finish = () => { if (runRef.current === run && i === chunks.length - 1) doneRef.current(); };
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    });
  }, []);

  const speak = useCallback((text: string) => {
    if (!callSpeechSupported) return;
    const chunks = splitForSpeech(text);
    if (chunks.length === 0) { doneRef.current(); return; }
    cancel();
    const run = runRef.current;
    spokenRef.current = text;

    if (!hasAudio || Date.now() - failedAtRef.current < TTS_COOLDOWN_MS) { speakWithBrowser(chunks, run); return; }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const blobs: Promise<Blob | null>[] = [];
    const load = (i: number) => (blobs[i] ??= requestTts(chunks[i], ctrl.signal).catch(() => null));

    void (async () => {
      for (let i = 0; i < chunks.length; i++) {
        const blob = await load(i);
        if (runRef.current !== run) return;
        if (i + 1 < chunks.length) void load(i + 1);
        const ok = blob ? await playBlob(blob) : false;
        if (runRef.current !== run) return;
        if (!ok) {
          failedAtRef.current = Date.now();
          speakWithBrowser(chunks.slice(i), run);
          return;
        }
      }
      doneRef.current();
    })();
  }, [cancel, playBlob, speakWithBrowser]);

  // iOS only lets playback start from a user gesture: a silent clip played on the
  // reused element inside the "Ligar" tap unlocks later, programmatic replies (the
  // silent utterance does the same for the browser-voice fallback).
  const prime = useCallback(() => {
    if (hasAudio) {
      const el = audio();
      el.src = SILENT_WAV;
      el.play().catch(() => {});
    }
    if (hasSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  }, [audio]);

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ speak, cancel, prime, spokenRef }), [speak, cancel, prime]);
}
