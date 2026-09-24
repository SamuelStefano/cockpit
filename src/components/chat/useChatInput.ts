import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PermMode } from '../../../shared/protocol';
import { classifySlash } from './slash';
import { nextRecall, type Caret } from './recall';
import { stripAnsiArrows } from './ansi-keys';
import { suggestCompletion, clipGhost } from './suggest';
import { loadPromptHistory, recordPrompt } from './prompt-history';
import { useSpeechInput } from './useSpeechInput';
import { fitHeight } from './fit-height';
import { useFileDrop } from './useFileDrop';
import { useSlashPalette } from './useSlashPalette';
import { useComposerRecall } from './useComposerRecall';
import { pickFreshUploads } from './dedupe-uploads';
import { isVirtualKeyboardOnly } from './touch';

interface UseChatInputArgs {
  disabled: boolean;
  onSend: (text: string, modeOverride?: PermMode) => void;
  onStop: () => void;
  value: string;
  setValue: (v: string) => void;
  setMode: (m: PermMode) => void;
  setModel: (m: string) => void;
  slashCommands: string[];
  hasAtt: boolean;
  attUploading?: boolean;
  onUpload: (file: File) => void;
  focusSignal: number;
  onQueue: (text: string) => void;
  history: string[];
  pendingConfirm?: () => void;
  onNew: () => void;
  onShowHelp?: () => void;
  paused?: boolean;
}

export function useChatInput(args: UseChatInputArgs) {
  const { disabled, onSend, onStop, value, setValue, setMode, setModel, slashCommands, hasAtt, attUploading, onUpload, focusSignal, onQueue, history, pendingConfirm, onNew, onShowHelp, paused } = args;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Input separado do fileRef só pra `capture`: o mesmo input não pode oferecer
  // "escolher arquivo" e "abrir a câmera" ao mesmo tempo.
  const cameraRef = useRef<HTMLInputElement>(null);
  const touch = useMemo(isVirtualKeyboardOnly, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  // Ditado por voz escreve direto no composer (value/setValue). Mora aqui pra o
  // textarea poder ficar readOnly enquanto grava (não dá pra digitar e ditar ao
  // mesmo tempo: o próximo trecho reconhecido sobrescreveria o que foi digitado).
  // Fallback de voz no mobile sem Web Speech API: foca o composer pra o usuário
  // acionar o ditado do teclado nativo.
  const mic = useSpeechInput(value, setValue, () => taRef.current?.focus());
  // Assinaturas recém-enviadas pra deduplicar o mesmo arquivo repetido (bug iOS).
  const recentUploads = useRef<Map<string, number>>(new Map());
  // Sobe vários arquivos respeitando o teto (espelha o backend); retorna quantos
  // passaram pra o caller decidir se houve upload (ex: paste consome o evento).
  const uploadFiles = (files: File[]): number => {
    let n = 0;
    for (const f of pickFreshUploads(files, recentUploads.current, Date.now())) {
      if (f.size > 15_000_000) continue;
      onUpload(f); n++;
    }
    return n;
  };
  const dnd = useFileDrop(uploadFiles, true);
  const { sel, setSel, matches, showPalette, setDismissed } = useSlashPalette(disabled, value, slashCommands);
  const { histIdx, setHistIdx, recall } = useComposerRecall(history, setValue, taRef);
  // Sugestão fantasma (cinza): histórico global persistido + sessão atual (sessão
  // por último = prioridade, a varredura é do fim). Só com a sessão a sugestão
  // quase nunca disparava — você teria que redigitar um prompt da MESMA conversa.
  // Aceita com Tab, → (no fim do texto) ou toque no chip (mobile).
  const ghost = !showPalette && !mic.listening ? suggestCompletion([...loadPromptHistory(), ...history], value) : '';
  const ghostShown = clipGhost(ghost);
  const acceptGhost = () => {
    setValue(value + ghost);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); fitHeight(el); }
    });
  };
  const complete = (cmd: string) => {
    setValue('/' + cmd + ' ');
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  };
  // Draft que chega de FORA do grow (restaurado no refresh, troca de sessão,
  // ditado): o textarea ficava em 1 linha escondendo o fim do texto. Ajusta a
  // altura e rola pro fim; digitação normal não passa aqui (composer focado).
  useEffect(() => {
    const el = taRef.current;
    if (!el || document.activeElement === el) return;
    fitHeight(el);
    el.scrollTop = el.scrollHeight;
  }, [value]);
  useEffect(() => {
    if (focusSignal === 0) return;
    const el = taRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    fitHeight(el);
  }, [focusSignal]);
  // Slash-commands emulados no app: o `claude -p` headless NÃO interpreta slash
  // (viram texto literal no prompt). Interceptamos um conjunto conhecido e
  // disparamos a ação local; tudo que não casa segue pro modelo como antes.
  // Returns what stays in the composer (null = not an app-side command).
  const runSlash = (raw: string): string | null => {
    const a = classifySlash(raw);
    if (!a) return null;
    switch (a.kind) {
      // The composer draft follows the active session, so after onNew the text
      // after `/new` lands in the new session's composer.
      case 'help': onShowHelp?.(); return a.rest ?? '';
      case 'new': onNew(); return a.rest ?? '';
      case 'model': setModel(a.model); break;
      case 'mode':
        setMode(a.mode);
        if (a.rest) {
          recordPrompt(a.rest);
          if (disabled || paused) onQueue(a.rest);
          else onSend(a.rest, a.mode);
        }
        break;
      // Expande num prompt pronto e envia ao Claude (modo 'auto': lê/grava memória).
      // Ocupado entra na fila; livre vai direto com o modeOverride.
      case 'prompt':
        if (disabled || paused) onQueue(a.text);
        else onSend(a.text, a.mode);
        break;
    }
    return '';
  };
  const submit = () => {
    if (attUploading) return; // não envia com anexo ainda subindo (perderia o arquivo)
    const v = value.trim();
    const left = v.startsWith('/') ? runSlash(v) : null;
    if (left !== null) {
      mic.reset();
      setValue(left);
      if (taRef.current) taRef.current.style.height = 'auto';
      return;
    }
    // Ocupado OU teto do plano atingido: enfileira só o texto. Pausado, a fila não
    // drena (gate em useChatPanel), mas tudo que for digitado fica guardado e sai
    // sozinho quando a janela resetar — em vez de travar o composer e perder o texto.
    // Os anexos pendentes (attachmentsRef) embarcam no próximo envio real.
    if (disabled || paused) {
      if (!v && !hasAtt) return;
      if (v) recordPrompt(v);
      mic.reset();
      onQueue(v); setValue('');
    } else {
      if (!v && !hasAtt) return;
      recordPrompt(v);
      mic.reset();
      onSend(v); setValue('');
    }
    if (taRef.current) taRef.current.style.height = 'auto';
  };
  // Um passo de recall: `true` quando o histórico assumiu a tecla, `false` pra
  // deixar o cursor fazer o trabalho normal. `caret` null = posição desconhecida.
  const applyRecall = (dir: 'up' | 'down', current: string, caret: Caret | null): boolean => {
    const r = nextRecall(history, histIdx, current, dir, caret);
    if (!r) return false;
    if (r.histIdx === null) {
      setHistIdx(null);
      setValue('');
      if (taRef.current) taRef.current.style.height = 'auto';
    } else recall(r.histIdx);
    return true;
  };
  const caretOf = (): Caret | null => {
    const el = taRef.current;
    return el ? { start: el.selectionStart, end: el.selectionEnd } : null;
  };
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files ?? [])); // teto de 15MB espelha o backend
    e.target.value = '';
  };
  const compositionEndAt = useRef(-Infinity);
  const onCompositionEnd = (e: React.CompositionEvent) => { compositionEndAt.current = e.timeStamp; };
  const onKey = (e: React.KeyboardEvent) => {
    // IME em composição (dead key de acento, candidato CJK): o Enter/Tab confirma
    // o candidato, não envia a mensagem. Sem isto, digitar "ã" via ~+a no Linux
    // dispara um submit no meio da palavra. → moves between IME segments, so no key
    // of ours may act while composing. Safari sends the Enter that confirms a CJK
    // candidate right after compositionend, with isComposing=false and keyCode 229.
    // keyCode 229 alone is not enough: Linux IBus, Windows IMEs and Android hardware
    // keyboards report it on every key, and the Enter would never send (#807).
    if (e.nativeEvent.isComposing) return;
    if (e.keyCode === 229 && e.timeStamp - compositionEndAt.current < 100) return;
    if (showPalette) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        // Enter num comando app-side runnable dispara a ação direto; Tab (e os que
        // seguem pro Claude) só completam o texto pra revisão antes de enviar.
        if (e.key === 'Enter' && runSlash('/' + matches[sel]) !== null) {
          mic.reset();
          setValue('');
          if (taRef.current) taRef.current.style.height = 'auto';
          return;
        }
        complete(matches[sel]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setDismissed(true); return; }
    }
    // Aceita a sugestão fantasma: Tab em qualquer ponto, → só com o cursor no fim
    // (pra → ainda mover o cursor dentro do texto quando há seleção/posição no meio).
    if (ghost) {
      const el = taRef.current;
      const atEnd = !el || (el.selectionStart === value.length && el.selectionEnd === value.length);
      if (e.key === 'Tab' || (e.key === 'ArrowRight' && atEnd)) { e.preventDefault(); acceptGhost(); return; }
    }
    // Esc com a composição vazia durante um turno = parar o run (atalho do botão stop).
    if (e.key === 'Escape' && disabled && !value) { e.preventDefault(); onStop(); return; }
    // Recall de histórico (↑/↓), só fora da palette de slash. Num texto de várias
    // linhas a tecla cai no cursor (caretOf) em vez de trocar a mensagem.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!applyRecall(e.key === 'ArrowUp' ? 'up' : 'down', value, caretOf())) return; // cursor normal
      e.preventDefault();
      return;
    }
    // Teclado virtual não tem Shift+Enter usável: no toque o Enter quebra linha e
    // o envio é só pelo botão.
    if (e.key === 'Enter' && touch) return;
    // Composição vazia + banner pendente: Enter confirma o banner em vez de ser
    // um submit no-op. Só quando idle (com run em curso a barra vira stop/queue).
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !paused && !value.trim() && !hasAtt && pendingConfirm) {
      e.preventDefault(); pendingConfirm(); return;
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setHistIdx(null); submit(); }
  };
  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Teclado que entrega a seta como TEXTO (sequência ANSI crua ou a notação
    // "^[[A") nunca dispara o onKey: sem isto o `^[[A` ficava escrito na mensagem.
    // Tira a sequência do texto e aplica o mesmo recall do teclado de verdade.
    const { text, arrows, at } = stripAnsiArrows(e.target.value);
    if (arrows.length) {
      const dir = [...arrows].reverse().find((a) => a === 'up' || a === 'down') as 'up' | 'down' | undefined;
      if (dir && applyRecall(dir, text, { start: at, end: at })) return;
      setValue(text);
      if (histIdx !== null) setHistIdx(null);
      fitHeight(e.target);
      return;
    }
    setValue(text);
    if (histIdx !== null) setHistIdx(null); // digitar sai do modo recall
    fitHeight(e.target);
  };
  return { taRef, fileRef, cameraRef, sel, setSel, showPalette, matches, complete, submit, onKey, onCompositionEnd, grow, pick, ...dnd, mic, ghost, ghostShown, acceptGhost, touch, settingsOpen, openSettings: () => setSettingsOpen(true), closeSettings };
}
