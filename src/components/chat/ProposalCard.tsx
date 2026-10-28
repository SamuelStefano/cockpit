import { useEffect, useRef, useState } from 'react';
import { Icon, tokens } from '../primitives';
import { MdImage } from '../primitives/markdown/image-context';
import { letterFor } from './letter-shortcut';

export interface ProposalOption { label: string; description?: string; recommended: boolean }

interface ProposalCardProps {
  question: string;
  options: ProposalOption[];
  open: boolean;
  picked: number | null;
  inTeam: boolean;
  onPick: (i: number) => void;
  image?: string;
  deadline?: string;
  writing?: number | null;
  onSubmitText?: (text: string) => void;
  onCancelWrite?: () => void;
}

export function ProposalCard({ question, options, open, picked, inTeam, onPick, image, deadline, writing = null, onSubmitText, onCancelWrite }: ProposalCardProps) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (writing !== null) taRef.current?.focus(); }, [writing]);
  const send = () => { if (text.trim()) onSubmitText?.(text); };
  const rec = options.findIndex((o) => o.recommended);
  return (
    <div className="my-2 flex max-w-[560px] flex-col gap-2.5 rounded-xl border border-neutral-700 bg-neutral-900/40 px-4 py-3.5">
      {image && <div className="[&_img]:max-h-44 [&_img]:w-full [&_span]:max-w-none"><MdImage alt="" src={image} /></div>}
      <p className="text-[15px] font-semibold leading-snug text-neutral-100">{question}</p>
      <div role="group" aria-label={question} className="flex flex-col gap-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex flex-col gap-1.5">
          <button type="button" onClick={() => onPick(i)} disabled={!open}
            aria-keyshortcuts={open && inTeam ? letterFor(i) : undefined}
            className={`flex min-h-[38px] items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[14px] leading-snug transition ${tokens.focusRing} ${
              picked === i ? 'border-orange-500/60 bg-orange-500/10' : opt.recommended ? 'border-orange-500/40' : 'border-neutral-800'
            } ${open ? 'hover:border-neutral-700 hover:bg-neutral-800/60' : 'cursor-default'} ${!open && picked !== i ? 'opacity-60' : ''}`}>
            <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[12px] ${
              picked === i || opt.recommended ? 'bg-orange-500/15 text-orange-300' : 'bg-neutral-800 text-neutral-400'
            }`}>{letterFor(i)}</span>
            <span className="min-w-0 pt-px">
              <span className="block text-neutral-100">{opt.label}</span>
              {opt.description && <span className="block text-[13px] text-neutral-500">{opt.description}</span>}
            </span>
          </button>
          {writing === i && open && (
            <div className="flex items-end gap-2">
              <textarea ref={taRef} rows={2} aria-label="Escreva sua resposta" value={text} placeholder="Escreva sua resposta"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Escape') { e.preventDefault(); onCancelWrite?.(); }
                  else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                className="min-h-[44px] min-w-0 flex-1 resize-none rounded-lg border border-orange-500/40 bg-neutral-950 px-3 py-2 text-[14px] leading-snug text-neutral-100 outline-hidden placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-orange-500/40" />
              <button type="button" aria-label="Enviar resposta" onClick={send} disabled={!text.trim()}
                className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg bg-orange-500 text-neutral-950 transition enabled:hover:bg-orange-400 disabled:opacity-40 ${tokens.focusRing}`}>
                <Icon name="arrowUp" size={16} />
              </button>
            </div>
          )}
          </div>
        ))}
      </div>
      {open && (
        <p className="text-[12px] text-neutral-500">
          {rec >= 0 ? `Recomendo ${letterFor(rec)}. ` : ''}{inTeam ? 'Responda com a letra ou escreva outra ideia.' : 'Escolha uma opção ou escreva outra ideia.'}
          {deadline && inTeam ? ` Se ninguém responder até ${deadline}, eu seguro a rodada.` : ''}
        </p>
      )}
    </div>
  );
}
