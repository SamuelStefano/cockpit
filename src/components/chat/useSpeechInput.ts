import { useEffect, useMemo, useRef, useState } from 'react';
import { joinTranscript, SPEECH_LANG } from './speech';
import { speechErrorMessage, isFatalSpeechError } from './speech-errors';
import { toast } from '../primitives';

// Aparelho de toque (celular/tablet). Nesses, a Web Speech API costuma faltar
// (iOS Safari/webviews) ou ser instável — mas o TECLADO nativo tem ditado ótimo.
function isTouchMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  return coarse || (navigator.maxTouchPoints ?? 0) > 0;
}

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
export function useSpeechInput(value: string, setValue: (v: string) => void, focusComposer?: () => void) {
  // hasApi: Web Speech disponível (ditado in-app). No mobile sem API, ainda
  // mostramos o mic mas ele encaminha pro ditado do TECLADO — senão o usuário
  // "não conseguia falar por voz" no celular (o botão simplesmente sumia).
  const hasApi = useMemo(() => speechCtor() !== null, []);
  const keyboardMode = useMemo(() => !hasApi && isTouchMobile(), [hasApi]);
  const supported = hasApi || keyboardMode;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const wantRef = useRef(false);         // o usuário quer ditar (sobrevive a reinícios)
  const baseRef = useRef('');            // texto do composer no instante do start
  const finalRef = useRef('');           // trechos já finalizados (acumula entre reinícios)
  const lastErrorRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const gotResultRef = useRef(false);
  const fastFailRef = useRef(0);
  // setValue muda a cada render (closure); o ref deixa o onresult sempre usar o atual.
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  // Solta o mic e destaca handlers SÍNCRONO, sem mexer em estado React (seguro no
  // unmount). Não altera wantRef — quem decide parar de vez é o caller.
  const detach = () => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onresult = null; rec.onend = null; rec.onerror = null;
    recRef.current = null;
    try { rec.stop(); } catch { /* já parou */ }
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
    rec.onresult = (e) => {
      gotResultRef.current = true;
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
    rec.onend = () => {
      recRef.current = null;
      const err = lastErrorRef.current;
      lastErrorRef.current = null;
      // Parada fatal (permissão negada/indisponível): some o botão de ditar não,
      // mas mostra o porquê e zera a intenção.
      if (err && isFatalSpeechError(err)) {
        wantRef.current = false;
        setError(speechErrorMessage(err));
        setListening(false);
        return;
      }
      // Encerramento normal por pausa de fala (Android) ou transitório: reinicia
      // enquanto o usuário ainda quer ditar. Guarda contra loop de falha-na-largada.
      if (wantRef.current) {
        const quick = Date.now() - startedAtRef.current < 800;
        if (quick && !gotResultRef.current) {
          fastFailRef.current += 1;
          if (fastFailRef.current >= MAX_FAST_FAILS) {
            wantRef.current = false;
            setError(speechErrorMessage(err ?? 'no-speech'));
            setListening(false);
            return;
          }
        }
        begin();
        return;
      }
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // start() lança se chamado duas vezes rápido; o onend do anterior cuida do retry.
      recRef.current = null;
    }
  };

  // Mobile sem Web Speech API: em vez de ditar in-app, foca o campo e orienta usar
  // o microfone do teclado nativo (que é confiável no iOS/Android). Não tenta o
  // engine (que falharia) — só desbloqueia o caminho que funciona.
  const startKeyboard = () => {
    focusComposer?.();
    toast('Toque no 🎤 do teclado do celular pra ditar', { durationMs: 6000 });
  };

  const start = () => {
    if (keyboardMode) { startKeyboard(); return; }
    if (!speechCtor()) return;
    detach();
    setError(null);
    baseRef.current = value;
    finalRef.current = '';
    fastFailRef.current = 0;
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
    const rec = recRef.current;
    if (!rec) { setListening(false); return; }
    try { rec.stop(); } catch { detach(); setListening(false); }
    // Fallback: engine que não dispara onend após stop() deixaria listening preso.
    setTimeout(() => { if (recRef.current === rec || recRef.current === null) { if (!wantRef.current) setListening(false); } }, 1500);
  };

  // Desmontou no meio da gravação? Encerra o reconhecimento pra não vazar o mic.
  useEffect(() => () => { wantRef.current = false; detach(); }, []);

  // Sem isto o aviso de erro só sumia ao iniciar OUTRO ditado — quem desistiu do
  // mic ficava com o banner permanente no composer.
  const dismissError = () => setError(null);

  return { supported, listening, error, dismissError, start, stop, toggle: () => (listening ? stop() : start()) };
}
