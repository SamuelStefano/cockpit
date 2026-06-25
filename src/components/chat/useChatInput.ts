import { useEffect, useRef } from 'react';
import type { PermMode } from '../../../shared/protocol';
import { classifySlash } from './slash';
import { nextRecall } from './recall';
import { suggestCompletion, clipGhost } from './suggest';
import { loadPromptHistory, recordPrompt } from './prompt-history';
import { useSpeechInput } from './useSpeechInput';
import { fitHeight } from './fit-height';
import { useFileDrop } from './useFileDrop';
import { useSlashPalette } from './useSlashPalette';
import { useComposerRecall } from './useComposerRecall';
import { pickFreshUploads } from './dedupe-uploads';

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
  const { disabled, onSend, onStop, value, setValue, setMode, setModel, slashCommands, hasAtt, onUpload, focusSignal, onQueue, history, pendingConfirm, onNew, onShowHelp, paused } = args;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Ditado por voz escreve direto no composer (value/setValue). Mora aqui pra o
  // textarea poder ficar readOnly enquanto grava (não dá pra digitar e ditar ao
  // mesmo tempo: o próximo trecho reconhecido sobrescreveria o que foi digitado).
  const mic = useSpeechInput(value, setValue);
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
  const runSlash = (raw: string): boolean => {
    const a = classifySlash(raw);
    if (!a) return false;
    switch (a.kind) {
      case 'help': onShowHelp?.(); break;
      case 'new': onNew(); break;
      case 'model': setModel(a.model); break;
      case 'mode': setMode(a.mode); break;
      // Expande num prompt pronto e envia ao Claude (modo 'auto': lê/grava memória,
      // sem shell). Ocupado entra na fila; livre vai direto com o modeOverride.
      case 'prompt':
        if (disabled || paused) onQueue(a.text);
        else onSend(a.text, a.mode);
        break;
    }
    return true;
  };
  const submit = () => {
    const v = value.trim();
    if (v.startsWith('/') && runSlash(v)) {
      setValue('');
      if (taRef.current) taRef.current.style.height = 'auto';
      return;
    }
    // Ocupado OU teto do plano atingido: enfileira só o texto. Pausado, a fila não
    // drena (gate em useChatPanel), mas tudo que for digitado fica guardado e sai
    // sozinho quando a janela resetar — em vez de travar o composer e perder o texto.
    // Os anexos pendentes (attachmentsRef) embarcam no próximo envio real.
    if (disabled || paused) {
      if (!v) return;
      recordPrompt(v);
      onQueue(v); setValue('');
    } else {
      if (!v && !hasAtt) return;
      recordPrompt(v);
      onSend(v); setValue('');
    }
    if (taRef.current) taRef.current.style.height = 'auto';
  };
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files ?? [])); // teto de 15MB espelha o backend
    e.target.value = '';
  };
  const onKey = (e: React.KeyboardEvent) => {
    // IME em composição (dead key de acento, candidato CJK): o Enter/Tab confirma
    // o candidato, não envia a mensagem. Sem isto, digitar "ã" via ~+a no Linux
    // dispara um submit no meio da palavra.
    if (e.nativeEvent.isComposing && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape')) return;
    if (showPalette) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        // Enter num comando app-side runnable dispara a ação direto; Tab (e os que
        // seguem pro Claude) só completam o texto pra revisão antes de enviar.
        if (e.key === 'Enter' && runSlash('/' + matches[sel])) {
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
    // Recall de histórico (↑/↓), só fora da palette de slash.
    if (history.length && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const r = nextRecall(history, histIdx, value, e.key === 'ArrowUp' ? 'up' : 'down');
      if (!r) return; // cai no cursor normal
      e.preventDefault();
      if (r.histIdx === null) { setHistIdx(null); setValue(''); if (taRef.current) taRef.current.style.height = 'auto'; }
      else recall(r.histIdx);
      return;
    }
    // Composição vazia + banner pendente: Enter confirma o banner em vez de ser
    // um submit no-op. Só quando idle (com run em curso a barra vira stop/queue).
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !paused && !value.trim() && !hasAtt && pendingConfirm) {
      e.preventDefault(); pendingConfirm(); return;
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setHistIdx(null); submit(); }
  };
  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (histIdx !== null) setHistIdx(null); // digitar sai do modo recall
    fitHeight(e.target);
  };
  return { taRef, fileRef, sel, setSel, showPalette, matches, complete, submit, onKey, grow, pick, ...dnd, mic, ghost, ghostShown, acceptGhost };
}
