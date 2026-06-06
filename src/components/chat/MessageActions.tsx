import { useState } from 'react';
import { Icon } from '../primitives';
import type { Block } from '../../data/mock';
import { messageToText } from '../../lib/export';

export function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button
      onClick={copy}
      title="Copiar mensagem"
      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300"
    >
      <Icon name={copied ? 'check' : 'copy'} size={12} />
    </button>
  );
}

export function QuoteButton({ onClick, withLabel }: { onClick: () => void; withLabel?: boolean }) {
  if (withLabel) {
    return (
      <button
        onClick={onClick}
        title="Citar esta mensagem no compositor"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
      >
        <Icon name="message" size={11} /> citar
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      title="Citar esta mensagem no compositor"
      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300"
    >
      <Icon name="message" size={12} />
    </button>
  );
}

export function CopyMessageButton({ blocks }: { blocks: Block[] }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(messageToText(blocks)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button
      onClick={copy}
      title="Copiar resposta"
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
    >
      <Icon name={copied ? 'check' : 'copy'} size={11} /> {copied ? 'copiado' : 'copiar'}
    </button>
  );
}
