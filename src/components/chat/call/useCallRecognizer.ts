import { useEffect, useRef } from 'react';
import { SPEECH_LANG } from '../speech';
import { isFatalSpeechError, speechErrorMessage } from '../speech-errors';
import { speechCtor, type SpeechRecognition } from '../useSpeechInput';

const MAX_FAST_FAILS = 3;
const FAST_FAIL_MS = 800;

interface Args {
  active: boolean;
  onHeard: (text: string) => void;
  onFatal: (message: string) => void;
}

// Continuous recognition that survives the engine ending on every pause. Reports the
// text heard since the last reset(): reset() moves a cursor past the results already
// handled (echo or sent utterance), so the engine never has to be restarted for it.
export function useCallRecognizer({ active, onHeard, onFatal }: Args) {
  const baseRef = useRef(0);
  const lengthRef = useRef(0);
  const heardRef = useRef(onHeard);
  const fatalRef = useRef(onFatal);
  heardRef.current = onHeard;
  fatalRef.current = onFatal;

  useEffect(() => {
    const Ctor = speechCtor();
    if (!active || !Ctor) return;
    let alive = true;
    let rec: SpeechRecognition | null = null;
    let fastFails = 0;
    let lastError: string | null = null;

    const begin = () => {
      if (!alive) return;
      const next = new Ctor();
      rec = next;
      next.lang = SPEECH_LANG;
      next.continuous = true;
      next.interimResults = true;
      baseRef.current = 0;
      lengthRef.current = 0;
      const startedAt = Date.now();
      let gotResult = false;
      next.onresult = (e) => {
        gotResult = true;
        fastFails = 0;
        lengthRef.current = e.results.length;
        let text = '';
        for (let i = baseRef.current; i < e.results.length; i++) text += e.results[i][0].transcript;
        heardRef.current(text.trim());
      };
      next.onerror = (e) => { lastError = e?.error ?? 'unknown'; };
      next.onend = () => {
        if (!alive) return;
        const err = lastError;
        lastError = null;
        if (err && isFatalSpeechError(err)) { alive = false; fatalRef.current(speechErrorMessage(err)); return; }
        if (Date.now() - startedAt < FAST_FAIL_MS && !gotResult && ++fastFails >= MAX_FAST_FAILS) {
          alive = false;
          fatalRef.current(speechErrorMessage(err ?? 'no-speech'));
          return;
        }
        begin();
      };
      try {
        next.start();
      } catch {
        next.onend?.();
      }
    };

    begin();
    return () => {
      alive = false;
      if (!rec) return;
      rec.onresult = null; rec.onend = null; rec.onerror = null;
      try { rec.abort ? rec.abort() : rec.stop(); } catch { /* already stopped */ }
    };
  }, [active]);

  const reset = () => { baseRef.current = lengthRef.current; };
  return { reset };
}
