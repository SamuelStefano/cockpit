import { useEffect, useMemo, useRef, useState } from 'react';
import { joinTranscript, SPEECH_LANG } from './speech';

// Tipos mínimos da Web Speech API (não vêm no lib.dom de todo target). Só o que
// usamos: ditado contínuo com resultados parciais e final por trecho.
interface SpeechResult { 0: { transcript: string }; isFinal: boolean }
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognition;

function speechCtor(): SpeechCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Ditado por voz que escreve no composer. O texto falado é apensado ao que já
// estava digitado quando começou (baseRef), com os trechos finais acumulados +
// o parcial ao vivo. Degrada limpo onde o browser não suporta (iOS Safari,
// Firefox): `supported=false` → o botão de mic some.
export function useSpeechInput(value: string, setValue: (v: string) => void) {
  const supported = useMemo(() => speechCtor() !== null, []);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const baseRef = useRef('');     // texto do composer no instante do start
  const finalRef = useRef('');    // trechos já finalizados nesta gravação
  // setValue muda a cada render (closure); o ref deixa o onresult sempre usar o atual.
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  // Encerra o reconhecimento e SOLTA o mic sem mexer em estado React (seguro no
  // unmount). Destaca os handlers e zera recRef SÍNCRONO pra um start() logo em
  // seguida (toggle rápido off→on) não ser engolido pelo onend assíncrono.
  const hardStop = () => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onresult = null; rec.onend = null; rec.onerror = null;
    recRef.current = null;
    try { rec.stop(); } catch { /* já parou */ }
  };
  // Stop pedido pelo usuário: NÃO destacar handlers. O engine ainda dispara um
  // onresult final no stop() (o último trecho que estava como interim vira
  // isFinal); destacar antes perderia essas palavras. O onend então zera recRef
  // e o listening. Só o unmount/toggle-restart usa hardStop (solta o mic já).
  const stop = () => {
    const rec = recRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { recRef.current = null; setListening(false); }
  };

  const start = () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (recRef.current) hardStop();
    const rec = new Ctor();
    rec.lang = SPEECH_LANG;
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = value;
    finalRef.current = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setValueRef.current(joinTranscript(baseRef.current, finalRef.current + interim));
    };
    rec.onend = () => { recRef.current = null; setListening(false); };
    rec.onerror = () => { recRef.current = null; setListening(false); };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { recRef.current = null; setListening(false); }
  };

  // Desmontou no meio da gravação? Encerra o reconhecimento pra não vazar o mic
  // (sem setState — o componente já foi).
  useEffect(() => () => hardStop(), []);

  return { supported, listening, start, stop, toggle: () => (listening ? stop() : start()) };
}
