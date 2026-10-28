import { useCallback, useState } from 'react';
import type { ClientMsg, Memory, MemoryInput, ServerMsg } from '../../shared/protocol';

export interface Memories {
  memories: Memory[];
  memoriesLoaded: boolean;
  onMemList: () => void;
  onMemSave: (memory: MemoryInput) => void;
  onMemDelete: (id: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useMemories(send: (m: ClientMsg) => boolean): Memories {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesLoaded, setLoaded] = useState(false);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'memories') return false;
    setMemories(msg.items);
    setLoaded(true);
    return true;
  }, []);

  return {
    memories,
    memoriesLoaded,
    onMemList: useCallback(() => { send({ t: 'mem-list' }); }, [send]),
    onMemSave: useCallback((memory: MemoryInput) => { send({ t: 'mem-save', memory }); }, [send]),
    onMemDelete: useCallback((id: string) => { send({ t: 'mem-delete', id }); }, [send]),
    onMsg,
  };
}
