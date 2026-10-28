import { tokens } from '../primitives';
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
}

export function ProposalCard({ question, options, open, picked, inTeam, onPick, image, deadline }: ProposalCardProps) {
  const rec = options.findIndex((o) => o.recommended);
  return (
    <div className="my-2 flex max-w-[560px] flex-col gap-2.5 rounded-xl border border-neutral-700 bg-neutral-900/40 px-4 py-3.5">
      {image && <div className="[&_img]:max-h-44 [&_img]:w-full [&_span]:max-w-none"><MdImage alt="" src={image} /></div>}
      <p className="text-[15px] font-semibold leading-snug text-neutral-100">{question}</p>
      <div role="group" aria-label={question} className="flex flex-col gap-1.5">
        {options.map((opt, i) => (
          <button key={i} type="button" onClick={() => onPick(i)} disabled={!open}
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
