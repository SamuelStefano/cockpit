import { useState } from 'react';
import { Button, Icon, Badge, EmptyState, Markdown } from '../components/primitives';
import { useNotasEditor } from './notas/useNotasEditor';

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
  const { text, saved, counts, onChange, flush, clear } = useNotasEditor(notes, notesLoaded, onNotesGet, onNotesSave, connected);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  // ⌘S / Ctrl+S: salva já (sem esperar o debounce). preventDefault tira o "salvar página".
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flush(); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight text-neutral-100"><span aria-hidden className="h-4 w-1 rounded-full bg-gradient-to-b from-orange-400 to-orange-600" />Notas</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-neutral-500">
              <span>Rascunho livre, salvo automaticamente.</span>
              {counts.chars > 0 && <span className="tabular-nums text-neutral-600">{counts.words} palavras · {counts.lines} linhas</span>}
              <Badge tone={saved ? 'neutral' : 'orange'} dot>{saved ? 'salvo' : 'salvando…'}</Badge>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)} disabled={!text.trim()}
              title={preview ? 'Voltar a editar' : 'Pré-visualizar markdown'}>
              <Icon name={preview ? 'pencil' : 'file'} size={14} /> {preview ? 'Editar' : 'Prévia'}
            </Button>
            <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'} title="Copiar tudo" onClick={copy} disabled={!text.trim()} />
            <Button variant="ghost" size="sm" icon="trash" title="Limpar" onClick={clear} disabled={!text.trim()} />
            <Button variant="primary" size="sm" onClick={() => onAnalyze(text)} disabled={!text.trim()}>
              <Icon name="sparkles" size={14} /> Analisar com IA
            </Button>
          </div>
        </header>

        {!notesLoaded && connected ? (
          <div className="shimmer h-full flex-1 rounded-xl" />
        ) : preview ? (
          <div className="scroll-thin min-h-0 w-full flex-1 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hairline">
            <Markdown md={text} />
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            placeholder="Joga aqui as ideias soltas, links, trechos… quando acumular, clica em 'Analisar com IA' pra virar um contexto estruturado. (⌘S salva na hora)"
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
