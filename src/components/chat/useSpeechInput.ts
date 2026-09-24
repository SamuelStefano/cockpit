import { useEffect, useMemo, useRef, useState } from 'react';
import { joinTranscript, SPEECH_LANG } from './speech';
import { speechErrorMessage, isFatalSpeechError, noCaptureMessage, KEYBOARD_DICTATION_HINT } from './speech-errors';
import { rememberEngineFailure, hasRecentEngineFailure } from './speech-fallback';
// No toque a Web Speech API costuma faltar (iOS Safari/webviews) ou ser instável
// — mas o TECLADO nativo tem ditado ótimo.
import { isTouchMobile } from './touch';

// Tipos mínimos da Web Speech API (não vêm no lib.dom de todo target). Só o que
// usamos: ditado contínuo com resultados parciais e final por trecho.
interface SpeechResult { 0: { transcript: string }; isFinal: boolean }
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechErrorEvent { error: string }
interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort?(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onaudiostart?: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognition;

function speechCtor(): SpeechCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Limite de reinícios encadeados que falham na largada (engine que dispara
// onend/onerror em <800ms sem captar nada). Acima disso, desiste — senão o
// celular fica num loop de start/erro queimando bateria e mic.
const MAX_FAST_FAILS = 3;

// Quanto esperar por algum resultado quando o engine "ligou" mas nunca capta
// (iOS standalone/webview, ou Safari precisando de ~2s). Sem isto o mic pulsa
// pra sempre sem texto nem feedback.
export const NO_CAPTURE_MS = 8000;

// Depois que o mic de fato abriu (onaudiostart) o engine está vivo e só falta o
// servidor responder: no Android com rede ruim 8s cortava o ditado no meio do
// prompt de permissão ou da primeira frase. Aqui a espera é mais folgada.
export const NO_CAPTURE_AFTER_AUDIO_MS = 20000;

// Engine que não dispara onend depois de stop(): solta o mic à força.
const STOP_GRACE_MS = 1500;

function iosStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return /iP(hone|ad|od)/.test(navigator.userAgent) && nav.standalone === true;
}

// Ditado por voz que escreve no composer. O texto falado é apensado ao que já
// estava digitado quando começou (baseRef), com os trechos finais acumulados +
// o parcial ao vivo. Degrada limpo onde o browser não suporta (Firefox, webviews):
// `supported=false` → o botão de mic some.
//
// Mobile: o engine do Android encerra o reconhecimento a cada pausa de fala
// (dispara onend mesmo com `continuous=true`), então o ditado parecia "não
// funcionar" — ligava e desligava sozinho. Aqui a INTENÇÃO do usuário (wantRef)
// é separada do ciclo de vida do engine: enquanto o usuário quer ditar, cada
// onend reinicia o reconhecimento. Erros de permissão (not-allowed) são fatais e
// param com mensagem; transitórios (no-speech/network/aborted) só reiniciam.
//
// No toque NENHUMA falha do engine pode deixar o usuário sem caminho de ditar:
// webkitSpeechRecognition EXISTE no iOS standalone e em webviews Android, mas
// nunca capta (ou devolve not-allowed). Qualquer falha ali vira modo teclado —
// foca o composer e orienta o 🎤 do teclado nativo, que funciona.
export function useSpeechInput(value: string, setValue: (v: string) => void, focusComposer?: () => void) {
  const hasApi = useMemo(() => speechCtor() !== null, []);
  const touch = useMemo(isTouchMobile, []);
  // Modo teclado de saída: sem API, iOS pela tela inicial (nunca capta) ou engine
  // que já falhou por aqui recentemente — não faz o usuário esperar 8s de novo.
  const [keyboardMode, setKeyboardMode] = useState(() => touch && (!hasApi || iosStandalone() || hasRecentEngineFailure()));
  const supported = hasApi || touch;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const wantRef = useRef(false);         // o usuário quer ditar (sobrevive a reinícios)
  const baseRef = useRef('');            // texto do composer no instante do start
  const finalRef = useRef('');           // trechos já finalizados (acumula entre reinícios)
  const lastErrorRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const gotResultRef = useRef(false);
  const fastFailRef = useRef(0);
  const everGotResultRef = useRef(false); // captou algo em qualquer ponto desta sessão de ditado
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWatchdog = () => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
  };
  // setValue muda a cada render (closure); o ref deixa o onresult sempre usar o atual.
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  // Solta o mic e destaca handlers SÍNCRONO, sem mexer em estado React (seguro no
  // unmount). Não altera wantRef — quem decide parar de vez é o caller.
  const detach = () => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onresult = null; rec.onend = null; rec.onerror = null; rec.onaudiostart = null;
    recRef.current = null;
    try { rec.stop(); } catch { /* já parou */ }
  };

  // Caminho do teclado nativo: foca o campo e orienta usar o microfone do teclado
  // (confiável no iOS/Android). O aviso mora DENTRO do composer, não em toast:
  // toast fixo no rodapé fica atrás do teclado virtual no iOS.
  const startKeyboard = () => {
    focusComposer?.();
    setHint(KEYBOARD_DICTATION_HINT);
  };

  // O engine in-app falhou de vez. No toque degrada pro teclado (e lembra, pra
  // próxima abertura não repetir a espera); no desktop mostra o porquê.
  const giveUp = (message: string) => {
    wantRef.current = false;
    clearWatchdog();
    detach();
    setListening(false);
    if (!touch) { setError(message); return; }
    rememberEngineFailure();
    setKeyboardMode(true);
    startKeyboard();
  };

  const armWatchdog = (ms: number) => {
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (!wantRef.current || everGotResultRef.current) return;
      giveUp(noCaptureMessage(iosStandalone()));
    }, ms);
  };

  // Cria e inicia UM reconhecimento. Chamado no start do usuário e em cada
  // reinício automático (onend com wantRef ainda ligado). Mantém finalRef pra não
  // perder o que já foi ditado nos trechos anteriores.
  const begin = () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = SPEECH_LANG;
    rec.continuous = true;
    rec.interimResults = true;
    startedAtRef.current = Date.now();
    gotResultRef.current = false;
    // Enquanto a sessão nunca captou nada, vigia: engine "ligado" sem onresult
    // (iOS standalone/webview, ou Safari esperando ~2s) não pode pulsar pra sempre.
    if (!everGotResultRef.current) armWatchdog(NO_CAPTURE_MS);
    rec.onaudiostart = () => {
      if (!everGotResultRef.current && wantRef.current) armWatchdog(NO_CAPTURE_AFTER_AUDIO_MS);
    };
    rec.onresult = (e) => {
      gotResultRef.current = true;
      everGotResultRef.current = true;
      clearWatchdog();
      fastFailRef.current = 0;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setValueRef.current(joinTranscript(baseRef.current, finalRef.current + interim));
    };
    rec.onerror = (e) => { lastErrorRef.current = e?.error ?? 'unknown'; };
    const ended = () => {
      recRef.current = null;
      const err = lastErrorRef.current;
      lastErrorRef.current = null;
      // Parada fatal (permissão negada/indisponível): não adianta reiniciar.
      if (err && isFatalSpeechError(err)) { giveUp(speechErrorMessage(err)); return; }
      // Encerramento normal por pausa de fala (Android) ou transitório: reinicia
      // enquanto o usuário ainda quer ditar. Guarda contra loop de falha-na-largada.
      if (wantRef.current) {
        const quick = Date.now() - startedAtRef.current < 800;
        if (quick && !gotResultRef.current) {
          fastFailRef.current += 1;
          if (fastFailRef.current >= MAX_FAST_FAILS) { giveUp(speechErrorMessage(err ?? 'no-speech')); return; }
        }
        begin();
        return;
      }
      setListening(false);
    };
    rec.onend = ended;
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // start() lançou (engine ocupado/indisponível): sem onend ninguém reiniciaria
      // e o composer ficava readOnly pra sempre. Trata como largada falha.
      rec.onresult = null; rec.onend = null; rec.onerror = null; rec.onaudiostart = null;
      ended();
    }
  };

  const start = () => {
    if (keyboardMode || !speechCtor()) { startKeyboard(); return; }
    detach();
    setError(null);
    setHint(null);
    baseRef.current = value;
    finalRef.current = '';
    fastFailRef.current = 0;
    everGotResultRef.current = false;
    clearWatchdog();
    lastErrorRef.current = null;
    wantRef.current = true;
    setListening(true);
    begin();
  };

  // Stop pedido pelo usuário: zera a intenção ANTES de parar o engine pra o onend
  // não reiniciar. stop() (não abort) deixa o engine emitir o último trecho interim
  // como final antes de encerrar.
  const stop = () => {
    wantRef.current = false;
    clearWatchdog();
    const rec = recRef.current;
    if (!rec) { setListening(false); return; }
    try { rec.stop(); } catch { detach(); setListening(false); return; }
    // Engine que não dispara onend após stop() deixaria listening preso E o mic
    // aberto (onresult tardio escreveria no composer depois do "parar").
    setTimeout(() => {
      if (wantRef.current) return;
      if (recRef.current === rec) detach();
      setListening(false);
    }, STOP_GRACE_MS);
  };

  // The composer was sent or cleared mid-dictation: drop the recognizer and what it
  // already heard. A plain stop() flushes the last partial as final, and the next
  // result rebuilds base + everything said — the sent prompt would come back.
  const reset = () => {
    wantRef.current = false;
    clearWatchdog();
    detach();
    baseRef.current = '';
    finalRef.current = '';
    setListening(false);
  };

  // Desmontou no meio da gravação? Encerra o reconhecimento pra não vazar o mic.
  useEffect(() => () => { wantRef.current = false; clearWatchdog(); detach(); }, []);

  // A dica do teclado some sozinha quando o texto muda (o usuário já achou o 🎤
  // ou preferiu digitar) — não precisa fechar à mão.
  const hintValueRef = useRef(value);
  useEffect(() => {
    if (hint && value !== hintValueRef.current) setHint(null);
    hintValueRef.current = value;
  }, [value, hint]);

  // Sem isto o aviso de erro só sumia ao iniciar OUTRO ditado — quem desistiu do
  // mic ficava com o banner permanente no composer.
  const dismissError = () => setError(null);
  const dismissHint = () => setHint(null);

  return { supported, keyboardMode, listening, error, hint, dismissError, dismissHint, start, stop, reset, toggle: () => (listening ? stop() : start()) };
}
