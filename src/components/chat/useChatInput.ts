import { useState, useEffect, useRef, useMemo } from 'react';
import type { PermMode } from '../../../shared/protocol';
import { classifySlash } from './slash';

const MAX_UPLOAD = 15_000_000;

interface UseChatInputArgs {
  disabled: boolean;
  onSend: (text: string) => void;
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
}

const fitHeight = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
};

export function useChatInput(args: UseChatInputArgs) {
  const { disabled, onSend, onStop, value, setValue, setMode, setModel, slashCommands, hasAtt, onUpload, focusSignal, onQueue, history, pendingConfirm, onNew, onShowHelp } = args;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState(0);
  // "/" sozinho lista tudo; espaços continuam filtrando (comandos multi-palavra
  // como "model opus"/"effort low"). Newline = mensagem de verdade, não comando.
  const slashOpen = !disabled && value.startsWith('/') && !value.includes('\n');
  const slashQuery = slashOpen ? value.slice(1).toLowerCase() : '';
  const matches = useMemo(
    () => (slashOpen ? slashCommands.filter((c) => c.toLowerCase().includes(slashQuery)).slice(0, 8) : []),
    [slashOpen, slashQuery, slashCommands],
  );
  const [dismissed, setDismissed] = useState(false);
  const showPalette = matches.length > 0 && !dismissed;
  // Esc dispensa a palette mas preserva o texto; digitar de novo a traz de volta.
  useEffect(() => { setSel(0); setDismissed(false); }, [slashQuery, slashOpen]);
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
    // Enquanto ocupado, anexos ficam fora da fila (são por-sessão); só texto.
    if (disabled) {
      if (!v) return;
      onQueue(v); setValue('');
    } else {
      if (!v && !hasAtt) return;
      onSend(v); setValue('');
    }
    if (taRef.current) taRef.current.style.height = 'auto';
  };
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      if (f.size > MAX_UPLOAD) continue; // teto de 15MB (espelha o backend)
      onUpload(f);
    }
    e.target.value = '';
  };
  // Recall estilo shell: ↑ no campo vazio puxa o último prompt enviado; ↑/↓
  // navegam o histórico; ↓ abaixo do fim limpa. Histórico = msgs do usuário.
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const recall = (idx: number) => {
    setHistIdx(idx);
    setValue(history[idx]);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.setSelectionRange(el.value.length, el.value.length);
      fitHeight(el);
    });
  };
  const onKey = (e: React.KeyboardEvent) => {
    // IME em composição (dead key de acento, candidato CJK): o Enter/Tab confirma
    // o candidato, não envia a mensagem. Sem isto, digitar "ã" via ~+a no Linux
    // dispara um submit no meio da palavra.
    if (e.nativeEvent.isComposing && (e.key === 'Enter' || e.key === 'Tab')) return;
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
    // Esc com a composição vazia durante um turno = parar o run (atalho do botão stop).
    if (e.key === 'Escape' && disabled && !value) { e.preventDefault(); onStop(); return; }
    // Recall de histórico (↑/↓), só fora da palette de slash.
    if (history.length && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      if (e.key === 'ArrowUp') {
        if (histIdx === null) { if (value !== '') return; e.preventDefault(); recall(history.length - 1); return; }
        e.preventDefault(); recall(Math.max(0, histIdx - 1)); return;
      }
      if (histIdx === null) return; // ↓ sem recall ativo = cursor normal
      e.preventDefault();
      const next = histIdx + 1;
      if (next >= history.length) { setHistIdx(null); setValue(''); if (taRef.current) taRef.current.style.height = 'auto'; }
      else recall(next);
      return;
    }
    // Composição vazia + banner pendente: Enter confirma o banner em vez de ser
    // um submit no-op. Só quando idle (com run em curso a barra vira stop/queue).
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !value.trim() && !hasAtt && pendingConfirm) {
      e.preventDefault(); pendingConfirm(); return;
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setHistIdx(null); submit(); }
  };
  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (histIdx !== null) setHistIdx(null); // digitar sai do modo recall
    fitHeight(e.target);
  };
  return { taRef, fileRef, sel, setSel, showPalette, matches, complete, submit, onKey, grow, pick };
}
