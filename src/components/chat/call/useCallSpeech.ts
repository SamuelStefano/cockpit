import { useCallback, useEffect, useMemo, useRef } from 'react';
import { SPEECH_LANG } from '../speech';
import { splitForSpeech } from './utterance';

export const callSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Speaks short chunks one after another: Chrome silently stops a single long
// utterance after ~15s. Every cancel() bumps `run` so late callbacks from an
// interrupted reply never fire onDone for the next one.
export function useCallSpeech(onDone: () => void) {
  const runRef = useRef(0);
  const spokenRef = useRef('');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const cancel = useCallback(() => {
    runRef.current += 1;
    spokenRef.current = '';
    if (callSpeechSupported) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    if (!callSpeechSupported) return;
    const chunks = splitForSpeech(text);
    if (chunks.length === 0) { doneRef.current(); return; }
    cancel();
    const run = runRef.current;
    spokenRef.current = text;
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = SPEECH_LANG;
      const finish = () => { if (runRef.current === run && i === chunks.length - 1) doneRef.current(); };
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    });
  }, [cancel]);

  // iOS only lets speechSynthesis start from a user gesture: a silent utterance
  // queued inside the "Ligar" tap unlocks later, programmatic replies.
  const prime = useCallback(() => {
    if (callSpeechSupported) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  }, []);

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ speak, cancel, prime, spokenRef }), [speak, cancel, prime]);
}
