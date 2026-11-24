import { useEffect, useRef, useState } from 'react';
import type { Memory, MemoryInput, TeamBot } from '../../../../shared/protocol';
import { Button, Icon, IconButton } from '../../../components/primitives';
import { Readers } from './Readers';
import { savedLabel } from './memory-view';

const AUTOSAVE_MS = 700;

interface MemoryEditorProps {
  memory: Memory;
  memories: Memory[];
  bots: TeamBot[];
  now: number;
  onSave: (m: MemoryInput) => void;
  onDelete: (id: string) => void;
}

export function MemoryEditor({ memory, memories, bots, now, onSave, onDelete }: MemoryEditorProps) {
  const [title, setTitle] = useState(memory.title);
  const [body, setBody] = useState(memory.body);
  const [confirming, setConfirming] = useState(false);
  const locked = !!memory.fromDisk;
  const dirty = !locked && (title !== memory.title || body !== memory.body);
  const latest = useRef({ title, body, memory, onSave });
  latest.current = { title, body, memory, onSave };

  const base = useRef({ title: memory.title, body: memory.body });
  useEffect(() => {
    const b = base.current;
    if (title === b.title && body === b.body) { setTitle(memory.title); setBody(memory.body); }
    base.current = { title: memory.title, body: memory.body };
  }, [memory.title, memory.body]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty || !title.trim()) return;
    const t = setTimeout(() => {
      const c = latest.current;
      c.onSave({ id: c.memory.id, title: c.title, body: c.body, agents: c.memory.agents, ...(c.memory.fileName ? { fileName: c.memory.fileName } : {}) });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, title, body]);

  const toggle = (botId: string) => {
    const agents = memory.agents.includes(botId) ? memory.agents.filter((a) => a !== botId) : [...memory.agents, botId];
    onSave({ id: memory.id, title, body, agents, ...(memory.fileName ? { fileName: memory.fileName } : {}) });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/45">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3.5 py-2.5">
        {locked && <Icon name="lock" size={14} className="shrink-0 text-neutral-500" />}
        <input
          readOnly={locked} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título da memória" maxLength={120}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-neutral-100 outline-hidden"
        />
        <span className="shrink-0 text-[12px] text-neutral-600" role="status">{locked ? 'só leitura' : dirty ? 'salvando…' : savedLabel(memory.updatedAt, now)}</span>
        {locked ? null : confirming ? (
          <>
            <Button size="xs" variant="danger" onClick={() => onDelete(memory.id)}>Apagar mesmo</Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
          </>
        ) : (
          <IconButton icon="trash" label="Apagar memória" size="sm" onClick={() => setConfirming(true)} />
        )}
      </div>
      <textarea
        readOnly={locked} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Texto da memória" spellCheck
        placeholder="Escreva aqui o que a equipe precisa saber."
        className="block min-h-80 w-full resize-none bg-transparent px-4.5 py-4 text-[14px] leading-[1.65] text-neutral-100 outline-hidden placeholder:text-neutral-600"
      />
      <Readers bots={bots} agents={memory.agents} memories={memories} onToggle={toggle} />
    </div>
  );
}
