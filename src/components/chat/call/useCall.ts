import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Message } from '../../../data/types';
import type { Phase } from '../useChatPanel';
import { speechCtor } from '../useSpeechInput';
import { callReducer, initialCallState, recognizerShouldRun } from './call-machine';
import { pickSpokenReply } from './pick-reply';
import { endOfUtteranceDelay, isBargeIn, isEcho, isSendable } from './utterance';
import { callSpeechSupported, useCallSpeech } from './useCallSpeech';
import { useCallRecognizer } from './useCallRecognizer';
import { useWakeLock } from './useWakeLock';
import { leftConversation } from './session-switch';

const NO_TURN_START_MS = 20000;

interface Args {
  messages: Message[];
  phase: Phase;
  onSend: (text: string) => void;
  sessionKey?: string;
  // `new-…` key -> real session id, as soon as the server reports it.
  pendingIds?: Record<string, string>;
}

export type CallApi = ReturnType<typeof useCall>;

export function useCall({ messages, phase, onSend, sessionKey = '', pendingIds }: Args) {
  const supported = callSpeechSupported && speechCtor() !== null;
  const [state, dispatch] = useReducer(callReducer, initialCallState);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaitingRef = useRef(false);
  const sawBusyRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const speech = useCallSpeech(useCallback(() => dispatch({ type: 'speech-done' }), []));
  const clearSilence = () => {
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null; }
  };

  const onFatal = useCallback((message: string) => {
    setError(message);
    dispatch({ type: 'hangup' });
  }, []);

  const recognizer = useCallRecognizer({
    active: recognizerShouldRun(state),
    onFatal,
    onHeard: (text) => {
      const current = stateRef.current;
      if (current.phase === 'speaking') {
        if (isEcho(text, speech.spokenRef.current)) { recognizer.reset(); return; }
        if (!isBargeIn(text, speech.spokenRef.current)) return;
        speech.cancel();
        dispatch({ type: 'barge-in' });
      }
      setHeard(text);
      clearSilence();
      if (!text) return;
      silenceRef.current = setTimeout(() => {
        silenceRef.current = null;
        recognizer.reset();
        setHeard('');
        if (!isSendable(text)) return;
        onSendRef.current(text);
        awaitingRef.current = true;
        sawBusyRef.current = false;
        dispatch({ type: 'utterance-sent' });
      }, endOfUtteranceDelay(text));
    },
  });

  useEffect(() => {
    if (state.phase !== 'thinking' || !awaitingRef.current) return;
    if (phase !== 'idle') { sawBusyRef.current = true; return; }
    if (!sawBusyRef.current) {
      const t = setTimeout(() => { awaitingRef.current = false; dispatch({ type: 'no-reply' }); }, NO_TURN_START_MS);
      return () => clearTimeout(t);
    }
    awaitingRef.current = false;
    const reply = pickSpokenReply(messages);
    if (!reply) { dispatch({ type: 'no-reply' }); return; }
    dispatch({ type: 'reply-ready' });
    speech.speak(reply.text);
  }, [state.phase, phase, messages, speech]);

  useEffect(() => {
    if (state.muted) { clearSilence(); setHeard(''); }
  }, [state.muted]);

  useEffect(() => {
    if (state.phase === 'off') { clearSilence(); setHeard(''); awaitingRef.current = false; speech.cancel(); }
  }, [state.phase, speech]);

  const prevKeyRef = useRef(sessionKey);
  const migratedToRef = useRef<string | undefined>(undefined);
  if (pendingIds?.[sessionKey]) migratedToRef.current = pendingIds[sessionKey];
  useEffect(() => {
    const prev = prevKeyRef.current;
    prevKeyRef.current = sessionKey;
    const left = leftConversation(prev, sessionKey, migratedToRef.current);
    migratedToRef.current = pendingIds?.[sessionKey];
    if (left) dispatch({ type: 'hangup' });
  }, [sessionKey, pendingIds]);

  useEffect(() => clearSilence, []);

  useWakeLock(state.phase !== 'off');

  const dial = () => {
    setError(null);
    speech.prime();
    dispatch({ type: 'dial' });
  };
  const hangup = () => dispatch({ type: 'hangup' });
  const toggleMute = () => dispatch({ type: 'toggle-mute' });
  const interrupt = () => { speech.cancel(); dispatch({ type: 'barge-in' }); };

  return { supported, state, heard, error, dial, hangup, toggleMute, interrupt, dismissError: () => setError(null) };
}
