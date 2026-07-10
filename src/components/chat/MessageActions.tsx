import { Icon, tokens } from '../primitives';
import type { Block } from '../../data/mock';
import { messageToText } from '../../lib/export';
import { useCopied } from '../../lib/useCopied';

export function CopyTextButton({ text }: { text: string }) {
  const [copied, copy, failed] = useCopied();
  return (
    <button
      onClick={() => copy(text)}
      title={failed ? 'Falha ao copiar' : 'Copiar mensagem'}
      className={`flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-neutral-800 ${failed ? 'text-red-400' : 'text-neutral-600 hover:text-neutral-300'} ${tokens.focusRing}`}
    >
      <Icon name={copied ? 'check' : failed ? 'x' : 'copy'} size={12} />
    </button>
  );
}

export function QuoteButton({ onClick, withLabel }: { onClick: () => void; withLabel?: boolean }) {
  if (withLabel) {
    return (
      <button
        onClick={onClick}
        title="Citar esta mensagem no compositor"
        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 ${tokens.focusRing}`}
      >
        <Icon name="message" size={11} /> citar
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      title="Citar esta mensagem no compositor"
      className={`flex h-6 w-6 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300 ${tokens.focusRing}`}
    >
      <Icon name="message" size={12} />
    </button>
  );
}

// Regenerar (paridade ChatGPT): reenvia o último prompt do usuário — só aparece
// na última resposta com a sessão ociosa (regenerar msg antiga reescreveria o fim).
export function RegenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Gerar a resposta de novo (reenvia o último prompt)"
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 ${tokens.focusRing}`}
    >
      <Icon name="rotate" size={11} /> regenerar
    </button>
  );
}

export function CopyMessageButton({ blocks }: { blocks: Block[] }) {
  const [copied, copy, failed] = useCopied();
  return (
    <button
      onClick={() => copy(messageToText(blocks))}
      title={failed ? 'Falha ao copiar' : 'Copiar resposta'}
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] transition hover:bg-neutral-800 ${failed ? 'text-red-400' : 'text-neutral-500 hover:text-neutral-300'} ${tokens.focusRing}`}
    >
      <Icon name={copied ? 'check' : failed ? 'x' : 'copy'} size={11} /> {copied ? 'copiado' : failed ? 'falhou' : 'copiar'}
    </button>
  );
}
