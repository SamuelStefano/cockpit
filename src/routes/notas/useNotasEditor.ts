import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '../../components/primitives';

// Lógica do editor de notas: autosave com debounce, semente única ao carregar, flush
// no unmount, contadores e salvamento manual (⌘S). A UI só renderiza.
export type NotasStatus = 'saved' | 'saving' | 'offline';

export function useNotasEditor(notes: string, notesLoaded: boolean, onNotesGet: () => void, onNotesSave: (t: string) => boolean, connected: boolean) {
  const [text, setText] = useState(notes);
  const [status, setStatus] = useState<NotasStatus>('saved');
  const seeded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(text);
  latest.current = text;
  const statusRef = useRef<NotasStatus>(status);
  statusRef.current = status;

  useEffect(() => { if (connected) onNotesGet(); }, [connected, onNotesGet]);
  // Semeia o textarea uma vez (não atropela digitação se o servidor reenviar).
  useEffect(() => { if (notesLoaded && !seeded.current) { seeded.current = true; setText(notes); } }, [notesLoaded, notes]);

  // O envio com socket fechado é descartado em silêncio: sem olhar o retorno, o
  // editor anunciava "salvo" e o texto se perdia no reload.
  const push = useCallback((v: string) => { setStatus(onNotesSave(v) ? 'saved' : 'offline'); }, [onNotesSave]);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = undefined; }
    push(latest.current);
  }, [push]);

  const onChange = useCallback((v: string) => {
    setText(v);
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(v), 700);
  }, [push]);

  // Voltou a conexão com escrita pendente: reenvia sozinho em vez de esperar a
  // próxima tecla.
  // Only once the editor holds the server's text: a fragment typed before the
  // first load would otherwise overwrite the whole note.
  useEffect(() => { if (connected && statusRef.current === 'offline' && seeded.current) push(latest.current); }, [connected, push]);

  // Flush no unmount pra não perder os últimos 700ms digitados.
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); onNotesSave(latest.current); } }, [onNotesSave]);

  // Limpar apaga tudo sem modal: guarda o texto anterior e oferece desfazer no toast.
  const clear = useCallback(() => {
    const prev = latest.current;
    onChange('');
    if (prev) toast('Notas limpas', { action: { label: 'Desfazer', onClick: () => onChange(prev) }, durationMs: 8000 });
  }, [onChange]);

  const trimmed = text.trim();
  const counts = {
    chars: text.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: text ? text.split('\n').length : 0,
  };

  return { text, status, counts, onChange, flush, setText, clear };
}
