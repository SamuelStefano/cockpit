import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';

export interface Notes {
  notes: string;
  notesLoaded: boolean;
  onNotesGet: () => void;
  // Devolve se o frame saiu de verdade: com o socket fechado o descarte é silencioso
  // e o editor não pode dizer "salvo".
  onNotesSave: (text: string) => boolean;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useNotes(send: (m: ClientMsg) => boolean): Notes {
  const [notes, setNotes] = useState('');
  // Texto vazio ≠ "ainda não chegou": o flag separa skeleton de bloco vazio de verdade.
  const [notesLoaded, setNotesLoaded] = useState(false);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'notes') return false;
    setNotes(msg.text);
    setNotesLoaded(true);
    return true;
  }, []);

  return {
    notes,
    notesLoaded,
    onNotesGet: useCallback(() => { send({ t: 'notes-get' }); }, [send]),
    // The server never echoes a `notes` frame after a save, so the cache is
    // updated here. Without it, coming back to /notas seeded the editor with the
    // text from before the last edits, and the next keystroke saved over them.
    onNotesSave: useCallback((text: string) => {
      const ok = send({ t: 'notes-save', text });
      if (ok) setNotes(text);
      return ok;
    }, [send]),
    onMsg,
  };
}
