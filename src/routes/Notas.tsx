import { useState } from 'react';
import { Button, Badge, EmptyState, Markdown, RouteHeader } from '../components/primitives';
import { useNotasEditor } from './notas/useNotasEditor';
import { useCopied } from '../lib/useCopied';
import { comboLabel } from '../lib/platform';
import { useArmed } from '../components/primitives/useArmed';

interface Props {
  connected: boolean;
  notes: string;
  notesLoaded: boolean;
  onNotesGet: () => void;
  onNotesSave: (text: string) => boolean;
  onAnalyze: (text: string) => void;
}

// Rascunho livre: anota coisas soltas ao longo do tempo (autosave) e, quando quiser,
// manda a IA destilar tudo num contexto/memória estruturado.
export function Notas({ connected, notes, notesLoaded, onNotesGet, onNotesSave, onAnalyze }: Props) {
  const { text, status, counts, onChange, flush, clear } = useNotasEditor(notes, notesLoaded, onNotesGet, onNotesSave, connected);
  const statusBadge = { saved: { tone: 'neutral' as const, label: 'salvo' }, saving: { tone: 'orange' as const, label: 'salvando…' }, offline: { tone: 'red' as const, label: 'não salvo — sem conexão' } }[status];
  const [preview, setPreview] = useState(false);
  // useCopied has the execCommand fallback: navigator.clipboard is missing over
  // http/IP (the phone on the tailnet), where copying used to fail silently.
  const [copied, copyText] = useCopied(1500);
  const copy = () => copyText(text);
  // ⌘S / Ctrl+S: salva já (sem esperar o debounce). preventDefault tira o "salvar página".
  // Save what's typed first (the debounce may still hold the last keystrokes), and
  // ignore a second tap while the route is changing.
  const [analyzing, setAnalyzing] = useState(false);
  const wipe = useArmed();
  const analyze = () => { if (analyzing) return; setAnalyzing(true); flush(); onAnalyze(text); setTimeout(() => setAnalyzing(false), 3000); };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flush(); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <RouteHeader
          variant="page"
          title="Notas"
          subtitle={
            <>
              <span>Rascunho livre, salvo automaticamente.</span>
              {counts.chars > 0 && <span className="tabular-nums text-neutral-600">{counts.words} {counts.words === 1 ? 'palavra' : 'palavras'} · {counts.lines} {counts.lines === 1 ? 'linha' : 'linhas'}</span>}
              <Badge tone={statusBadge.tone} dot>{statusBadge.label}</Badge>
            </>
          }
          actions={
            <>
              <Button variant="ghost" size="sm" icon={preview ? 'pencil' : 'file'} onClick={() => setPreview((p) => !p)} disabled={!preview && !text.trim()}
                title={preview ? 'Voltar a editar' : 'Pré-visualizar markdown'}>
                {preview ? 'Editar' : 'Prévia'}
              </Button>
              <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'} title="Copiar tudo" onClick={copy} disabled={!text.trim()} />
              {/* The whole note, gone on one tap next to "copiar": two taps now. */}
              <Button variant={wipe.armed ? 'danger' : 'ghost'} size="sm" icon="trash" title={wipe.armed ? 'Toque de novo pra apagar a nota' : 'Limpar'}
                aria-label={wipe.armed ? 'Confirmar: apagar a nota' : 'Limpar'} onClick={() => wipe.fire(clear)} disabled={!text.trim()}>
                {wipe.armed ? 'apagar?' : undefined}
              </Button>
              <Button variant="primary" size="sm" icon="sparkles" onClick={analyze} disabled={!text.trim() || analyzing}>
                Analisar com IA
              </Button>
            </>
          }
        />

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
            // Offline before the first load there is nothing to edit yet: typing
            // here and reconnecting would save the fragment over the whole note.
            readOnly={!notesLoaded}
            placeholder={`Joga aqui as ideias soltas, links, trechos… quando acumular, clica em 'Analisar com IA' pra virar um contexto estruturado. (${comboLabel(['⌘', 'S'])} salva na hora)`}
            spellCheck={false}
            className="scroll-thin min-h-0 w-full flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 font-mono text-[13px] leading-relaxed text-neutral-200 placeholder-neutral-600 outline-hidden transition focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/20"
          />
        )}

        {notesLoaded && !text.trim() && !connected && (
          <EmptyState icon="file" title="Sem conexão" description="Reconecte pra carregar e salvar suas notas." />
        )}
      </div>
    </div>
  );
}
