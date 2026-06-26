import { useState, useEffect, useRef, useCallback } from 'react';

// Lógica do editor de notas: autosave com debounce, semente única ao carregar, flush
// no unmount, contadores e salvamento manual (⌘S). A UI só renderiza.
export function useNotasEditor(notes: string, notesLoaded: boolean, onNotesGet: () => void, onNotesSave: (t: string) => void, connected: boolean) {
  const [text, setText] = useState(notes);
  const [saved, setSaved] = useState(true);
  const seeded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(text);
  latest.current = text;

  useEffect(() => { if (connected) onNotesGet(); }, [connected, onNotesGet]);
  // Semeia o textarea uma vez (não atropela digitação se o servidor reenviar).
  useEffect(() => { if (notesLoaded && !seeded.current) { seeded.current = true; setText(notes); } }, [notesLoaded, notes]);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = undefined; }
    onNotesSave(latest.current);
    setSaved(true);
  }, [onNotesSave]);

  const onChange = useCallback((v: string) => {
    setText(v);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { onNotesSave(v); setSaved(true); }, 700);
  }, [onNotesSave]);

  // Flush no unmount pra não perder os últimos 700ms digitados.
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); onNotesSave(latest.current); } }, [onNotesSave]);

  const trimmed = text.trim();
  const counts = {
    chars: text.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: text ? text.split('\n').length : 0,
  };

  return { text, saved, counts, onChange, flush, setText, clear: () => onChange('') };
}
