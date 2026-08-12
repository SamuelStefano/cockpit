import { useRef, useState } from 'react';
import { Icon, Markdown, tokens } from '../primitives';
import type { NarrationNote } from './shown';
import { fmtClock } from './message-format';

interface NarrationGroupCardProps {
  notes: NarrationNote[];
}

// Junta as notas de bastidor do turno numa linha só, expansível. Fechada mostra a
// última — é a que diz onde o agente estava quando parou de narrar. A resposta
// final nunca entra aqui: ela fica fora da caixa, inteira.
export function NarrationGroupCard({ notes }: NarrationGroupCardProps) {
  const [open, setOpen] = useState(false);
  const everOpen = useRef(false);
  everOpen.current ||= open;
  const preview = notes[notes.length - 1]?.md.replace(/[#*`>_]/g, '').replace(/\s+/g, ' ').trim();

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-neutral-800/70 bg-neutral-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Comentários que o agente escreveu durante o turno — a resposta final fica fora da caixa"
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-neutral-900 ${tokens.focusRing}`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-800/80 text-neutral-400">
          <Icon name="sparkles" size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-[12px] font-medium text-neutral-300">
            {notes.length} notas do agente
          </span>
          <span className="block truncate text-[10.5px] text-neutral-500">{preview}</span>
        </div>
        <Icon
          name="chevronDown"
          size={14}
          className="shrink-0 text-neutral-500 transition-transform duration-200"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-2.5 border-t border-neutral-800 px-3 pb-2.5 pt-2">
            {/* Fechada, a caixa não monta as notas: um turno tagarela
                re-renderizaria todo o markdown a cada token do streaming. */}
            {everOpen.current && notes.map((n) => (
              <div key={n.id} className="border-l border-neutral-800 pl-2.5">
                {n.ts && <span className="mb-0.5 block text-[10px] tabular-nums text-neutral-600">{fmtClock(n.ts)}</span>}
                <Markdown md={n.md} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
