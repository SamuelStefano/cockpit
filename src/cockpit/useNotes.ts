import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';

export interface Notes {
  notes: string;
  notesLoaded: boolean;
  onNotesGet: () => void;
  onNotesSave: (text: string) => void;
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
    onNotesSave: useCallback((text: string) => { send({ t: 'notes-save', text }); }, [send]),
    onMsg,
  };
}
