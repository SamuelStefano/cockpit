import { useState, useEffect, useRef } from 'react';
import { Button, Icon, EmptyState } from '../components/primitives';

interface Props {
  connected: boolean;
  notes: string;
  notesLoaded: boolean;
  onNotesGet: () => void;
  onNotesSave: (text: string) => void;
  onAnalyze: (text: string) => void;
}

// Rascunho livre: anota coisas soltas ao longo do tempo (autosave) e, quando quiser,
// manda a IA destilar tudo num contexto/memória estruturado.
export function Notas({ connected, notes, notesLoaded, onNotesGet, onNotesSave, onAnalyze }: Props) {
  const [text, setText] = useState(notes);
  const [saved, setSaved] = useState(true);
  const seeded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Pede o rascunho ao conectar; só semeia o textarea uma vez (não atropela o que o
  // usuário está digitando se o servidor reenviar).
  useEffect(() => { if (connected) onNotesGet(); }, [connected, onNotesGet]);
  useEffect(() => { if (notesLoaded && !seeded.current) { seeded.current = true; setText(notes); } }, [notesLoaded, notes]);

  const onChange = (v: string) => {
    setText(v);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { onNotesSave(v); setSaved(true); }, 700);
  };
  // Flush no unmount pra não perder o que foi digitado nos últimos 700ms.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const chars = text.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-neutral-100">Notas</h1>
            <p className="text-[12.5px] text-neutral-500">
              Rascunho livre, salvo automaticamente. {chars > 0 && <span className="tabular-nums">{chars} car.</span>}
              <span className="ml-2 text-neutral-600">{saved ? '· salvo' : '· salvando…'}</span>
            </p>
          </div>
          <Button
            variant="primary" size="sm"
            onClick={() => onAnalyze(text)}
            disabled={!text.trim()}
          >
            <Icon name="sparkles" size={14} /> Analisar com IA
          </Button>
        </header>

        {!notesLoaded && connected ? (
          <div className="shimmer h-full flex-1 rounded-xl" />
        ) : (
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Joga aqui as ideias soltas, links, trechos… quando acumular, clica em 'Analisar com IA' pra virar um contexto estruturado."
            spellCheck={false}
            className="scroll-thin min-h-0 w-full flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 font-mono text-[13px] leading-relaxed text-neutral-200 placeholder-neutral-600 outline-none transition focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/20"
          />
        )}

        {notesLoaded && !text.trim() && !connected && (
          <EmptyState icon="file" title="Sem conexão" description="Reconecte pra carregar e salvar suas notas." />
        )}
      </div>
    </div>
  );
}
