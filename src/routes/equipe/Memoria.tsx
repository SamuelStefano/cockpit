import { useEffect, useRef, useState } from 'react';
import type { Memory, MemoryInput, TeamBot } from '../../../shared/protocol';
import { Button, EmptyState, SkeletonCards } from '../../components/primitives';
import { MemoryList } from './memoria/MemoryList';
import { MemoryEditor } from './memoria/MemoryEditor';
import { MAX_FILE_BYTES, TEXT_FILE_RE, newMemoryId } from './memoria/memory-view';

interface MemoriaProps {
  bots: TeamBot[];
  memories: Memory[];
  loaded: boolean;
  connected: boolean;
  onList: () => void;
  onSave: (m: MemoryInput) => void;
  onDelete: (id: string) => void;
}

export function Memoria({ bots, memories, loaded, connected, onList, onSave, onDelete }: MemoriaProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fileError, setFileError] = useState('');
  const pending = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (connected) onList(); }, [connected, onList]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const shown = memories.find((m) => m.id === selected) ?? (selected !== null && selected === pending.current ? undefined : memories[0]);

  const create = (init: Partial<MemoryInput> = {}) => {
    const m: MemoryInput = { id: newMemoryId(), title: 'Nova memória', body: '', agents: [], ...init };
    pending.current = m.id ?? null;
    setSelected(m.id ?? null);
    onSave(m);
  };

  const onFile = async (file: File | undefined) => {
    setFileError('');
    if (!file) return;
    if (!TEXT_FILE_RE.test(file.name)) { setFileError('Por enquanto só texto (.txt, .md, .csv, .json). PDF e planilhas: em breve.'); return; }
    if (file.size > MAX_FILE_BYTES) { setFileError('Arquivo grande demais (máximo 200 KB).'); return; }
    create({ title: file.name, body: await file.text(), fileName: file.name });
  };

  const remove = (id: string) => {
    setSelected(null);
    onDelete(id);
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/40 px-3.5 py-3 text-[13px] text-neutral-400 max-md:hidden">
        <b className="font-medium text-neutral-200">Memória</b> é o que a equipe sabe antes de você falar: a marca, os produtos, as regras. Cada agente lê só as memórias ligadas a ele, em toda conversa.
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" icon="plus" onClick={() => create()}>Nova memória</Button>
        <Button size="sm" variant="ghost" icon="paperclip" onClick={() => fileRef.current?.click()}>Anexar arquivo</Button>
        <Button size="sm" variant="ghost" icon="download" disabled title="Importar a memória de outro lugar: em breve">Importar · em breve</Button>
        <input ref={fileRef} type="file" accept=".md,.markdown,.txt,.csv,.tsv,.json" className="hidden" aria-label="Anexar arquivo de memória" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {fileError && <p role="alert" className="mb-3 text-[12px] text-amber-400">{fileError}</p>}
      {!connected ? (
        <EmptyState size="sm" icon="x" title="Sem conexão" description="Quando o Deck voltar, as memórias aparecem aqui." className="py-16" />
      ) : !loaded ? (
        <SkeletonCards />
      ) : memories.length === 0 && !selected ? (
        <EmptyState size="sm" icon="clipboard" title="Nenhuma memória ainda" description="Escreva o que a equipe precisa saber: a voz da marca, os produtos, o que nunca prometer." className="py-16">
          <Button icon="plus" onClick={() => create()}>Escrever a primeira</Button>
        </EmptyState>
      ) : (
        <div className="grid items-start gap-5 md:grid-cols-[340px_1fr]">
          <MemoryList memories={memories} bots={bots} selectedId={shown?.id ?? null} now={now} onSelect={setSelected} />
          {shown && <MemoryEditor key={shown.id} memory={shown} memories={memories} bots={bots} now={now} onSave={onSave} onDelete={remove} />}
        </div>
      )}
    </div>
  );
}
